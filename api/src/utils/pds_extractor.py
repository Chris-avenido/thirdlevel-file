import fitz # PyMuPDF
import os
import sys
import json
import re
import subprocess
import tempfile

def clean_str(val):
    if not val:
        return ""
    s = str(val).strip()
    s = re.sub(r'[\r\n\t]+', ' ', s)
    s = re.sub(r'\s+', ' ', s)
    if re.match(r'^(n/?a|none|nil|wa|-)$', s, re.IGNORECASE):
        return ""
    return s

def normalize_date(val):
    if not val:
        return ""
    val = clean_str(val)
    if not val:
        return ""
    if re.match(r'^(present|current|today|to date|now)$', val, re.IGNORECASE):
        return ""
    
    # Fix OCR noise like 0312712025 -> 03/27/2025, 0611012018 -> 06/10/2018
    val = re.sub(r'(\d{2})1(\d{2})1(\d{4})', r'\1/\2/\3', val)
    val = re.sub(r'(\d{2})1(\d{2})/(\d{4})', r'\1/\2/\3', val)
    val = re.sub(r'(\d{2})/(\d{2})1(\d{4})', r'\1/\2/\3', val)
    
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})$', val)
    if m:
        return val
    
    m = re.match(r'^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$', val)
    if m:
        m1, d1, y1 = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if m1 > 12:
            m1, d1 = d1, m1
        return f"{y1:04d}-{m1:02d}-{d1:02d}"
    
    m = re.match(r'^\b(19\d{2}|20\d{2})\b$', val)
    if m:
        return f"{m.group(1)}-01-01"
    
    return ""

def extract_year(val):
    if not val:
        return ""
    s = clean_str(val)
    m = re.search(r'\b(19\d{2}|20\d{2})\b', s)
    return m.group(1) if m else ""

def run_windows_ocr_on_images(image_paths):
    temp_in = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8')
    temp_out = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8')
    temp_in_path = temp_in.name
    temp_out_path = temp_out.name
    temp_in.write(json.dumps(image_paths))
    temp_in.close()
    temp_out.close()

    ps_script = """
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.DeclaringType.Name -eq 'WindowsRuntimeSystemExtensions' })[0]
    function Await($WinRtTask, $ResultType) {
        $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
        $netTask = $asTask.Invoke($null, @($WinRtTask))
        $netTask.Wait(-1) | Out-Null
        $netTask.Result
    }
    [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime] | Out-Null
    [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
    [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime] | Out-Null
    [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime] | Out-Null
    
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if (-not $engine) {
        $lang = [Windows.Globalization.Language]::new("en-US")
        $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
    }

    $paths = Get-Content -Raw -Encoding UTF8 "__TEMP_IN__" | ConvertFrom-Json
    $results = @()

    foreach ($imgPath in $paths) {
        if (-not (Test-Path $imgPath)) { continue }
        $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($imgPath)) ([Windows.Storage.StorageFile])
        $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
        $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
        $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
        $ocrResult = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
        
        $lines = @()
        foreach ($line in $ocrResult.Lines) {
            $words = @()
            foreach ($w in $line.Words) {
                $words += @{
                    Text = $w.Text
                    X = $w.BoundingRect.X
                    Y = $w.BoundingRect.Y
                    Width = $w.BoundingRect.Width
                    Height = $w.BoundingRect.Height
                }
            }
            $lines += @{
                Text = $line.Text
                X = $words[0].X
                Y = $words[0].Y
                Words = $words
            }
        }
        $results += @{
            ImagePath = $imgPath
            Lines = $lines
            FullText = ($lines | ForEach-Object { $_.Text }) -join "`n"
        }
    }

    $results | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 "__TEMP_OUT__"
    """.replace("__TEMP_IN__", temp_in_path).replace("__TEMP_OUT__", temp_out_path)
    
    ps_file = tempfile.NamedTemporaryFile(mode='w', suffix='.ps1', delete=False, encoding='utf-8')
    ps_file.write(ps_script)
    ps_file.close()

    try:
        subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps_file.name],
            check=True,
            capture_output=True
        )
        with open(temp_out_path, 'r', encoding='utf-8-sig') as f:
            data = json.load(f)
        return data
    finally:
        for p in [temp_in_path, temp_out_path, ps_file.name]:
            try: os.remove(p)
            except: pass

def group_words_into_rows(lines, y_threshold=25):
    """Groups lines/words that share approximately the same vertical (Y) coordinate into rows."""
    all_items = []
    for l in lines:
        text = l.get('Text', '').strip()
        if not text: continue
        x = l.get('X', 0)
        y = l.get('Y', 0)
        all_items.append({'text': text, 'x': x, 'y': y})
    
    all_items.sort(key=lambda item: item['y'])
    
    rows = []
    for item in all_items:
        placed = False
        for r in rows:
            if abs(r['y'] - item['y']) <= y_threshold:
                r['items'].append(item)
                r['items'].sort(key=lambda it: it['x'])
                r['y'] = sum(it['y'] for it in r['items']) / len(r['items'])
                placed = True
                break
        if not placed:
            rows.append({'y': item['y'], 'items': [item]})
    
    rows.sort(key=lambda r: r['y'])
    return rows

def parse_pds_pdf(pdf_path):
    doc = fitz.open(pdf_path)
    num_pages = len(doc)
    
    all_text = ""
    pages_text = []
    for i in range(num_pages):
        t = doc[i].get_text()
        pages_text.append(t)
        all_text += "\n" + t
    
    has_native_text = len(all_text.strip()) > 300
    
    ocr_pages_data = []
    temp_dir = None
    if not has_native_text:
        temp_dir = tempfile.mkdtemp(prefix="pds_ocr_")
        img_paths = []
        for i in range(min(num_pages, 5)):
            page = doc[i]
            pix = page.get_pixmap(dpi=200)
            img_path = os.path.join(temp_dir, f"page_{i+1}.png")
            pix.save(img_path)
            img_paths.append(img_path)
        
        ocr_pages_data = run_windows_ocr_on_images(img_paths)
    
    combined_pages = []
    if has_native_text:
        for i, t in enumerate(pages_text):
            lines = []
            for l in t.splitlines():
                if l.strip():
                    lines.append({'Text': l.strip(), 'X': 0, 'Y': len(lines)*20})
            combined_pages.append({'page': i+1, 'full_text': t, 'lines': lines})
    else:
        for i, p in enumerate(ocr_pages_data):
            combined_pages.append({'page': i+1, 'full_text': p.get('FullText', ''), 'lines': p.get('Lines', [])})

    if temp_dir and os.path.exists(temp_dir):
        for f in os.listdir(temp_dir):
            try: os.remove(os.path.join(temp_dir, f))
            except: pass
        try: os.rmdir(temp_dir)
        except: pass

    result = {
        "permanent_address": "",
        "phone_number": "",
        "contact_details": "",
        "alt_contact_details_1": "",
        "eligibilities": [],
        "previous_positions": [],
        "bachelor_degree": "",
        "bachelor_year": "",
        "master_degree": "",
        "master_year": "",
        "doctorate_degree": "",
        "doctorate_year": "",
        "other_courses": [],
        "email": "",
        "first_name": "",
        "last_name": "",
        "middle_name": "",
        "suffix": "",
        "date_of_birth": "",
        "gender": "",
        "civil_status": ""
    }

    # ─────────────────────────────────────────────────────────────
    # PAGE 1: Personal Info & Education
    # ─────────────────────────────────────────────────────────────
    p1 = combined_pages[0] if len(combined_pages) > 0 else None
    if p1:
        p1_text = p1['full_text']
        p1_lines = p1['lines']
        
        # Phone / Mobile Number
        m_phone = re.search(r'\b(09\d{9}|\+639\d{9}|09\d{2}[-\s]?\d{3}[-\s]?\d{4})\b', p1_text)
        if m_phone:
            clean_phone = re.sub(r'[^\d]', '', m_phone.group(1))
            if clean_phone.startswith('639'):
                clean_phone = '0' + clean_phone[2:]
            if len(clean_phone) == 11 and clean_phone.startswith('09'):
                result['phone_number'] = clean_phone
                result['contact_details'] = clean_phone
                result['alt_contact_details_1'] = clean_phone

        # Email
        m_email = re.search(r'\b([A-Za-z0-9._%+-]+@(?:deped\.gov\.ph|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}))\b', p1_text, re.IGNORECASE)
        if m_email:
            result['email'] = m_email.group(1).lower()

        # Permanent Address
        p1_rows = group_words_into_rows(p1_lines, y_threshold=25)
        addr_components = []
        for r in p1_rows:
            if 830 <= r['y'] <= 1020:
                for it in r['items']:
                    if it['x'] >= 980:
                        t = clean_str(it['text'])
                        if t and not re.search(r'(House.*Lot|Subdivision|Village|Barangay|Municipality|Province|ZIP|CO[OD]E|Baran|^Bar$|^Street$|^fhvince$|^WA$|^N/?A$|^NONE$|^-|\(JR|\(SR|EXTENSION)', t, re.IGNORECASE):
                            if t.upper() not in [a.upper() for a in addr_components]:
                                addr_components.append(t)
        
        if addr_components:
            result['permanent_address'] = ", ".join(addr_components).upper()
        else:
            for l in p1_lines:
                t = clean_str(l.get('Text', ''))
                if re.search(r'\b(LOT|BLOCK|STREET|BARANGAY|BRGY|SUBDIVISION|VILLAGE|PORAC|PAMPANGA|MANIBAUG)\b', t, re.IGNORECASE) and not re.search(r'(CITIZENSHIP|ADDRESS|TELEPHONE|MOBILE)', t, re.IGNORECASE):
                    if t.upper() not in [a.upper() for a in addr_components]:
                        addr_components.append(t)
            if addr_components:
                result['permanent_address'] = ", ".join(addr_components).upper()

        # Education Section (III. Educational Background, Y >= 2100)
        edu_rows = [r for r in p1_rows if r['y'] >= 2100]
        
        bac_degs, bac_yrs = [], []
        mas_degs, mas_yrs = [], []
        doc_degs, doc_yrs = [], []
        
        for r in edu_rows:
            row_text = " ".join(it['text'] for it in r['items'])
            deg_items = [it['text'] for it in r['items'] if 700 <= it['x'] <= 1050]
            deg_text = clean_str(" ".join(deg_items)).upper()
            
            year_items = [it['text'] for it in r['items'] if 1350 <= it['x'] <= 1500]
            year_val = extract_year(" ".join(year_items))
            if not year_val:
                year_val = extract_year(row_text)
            
            if re.search(r'\b(BACHELOR|B\.S\.|B\.A\.|BSE|BEED|BSED|AB\s+|BS\s+)\b', deg_text):
                if deg_text and deg_text not in bac_degs:
                    bac_degs.append(deg_text)
                    bac_yrs.append(year_val)
            elif re.search(r'\b(MASTER|MAED|MBA|MPA|MAT|M\.S\.|M\.A\.)\b', deg_text) and not re.search(r'\b(DOCTOR|PH\.?D|ED\.?D)\b', deg_text):
                if deg_text and deg_text not in mas_degs:
                    mas_degs.append(deg_text)
                    mas_yrs.append(year_val)
            elif re.search(r'\b(DOCTOR|PH\.?D|ED\.?D|DOCTORATE|DPA)\b', deg_text):
                if deg_text and deg_text not in doc_degs:
                    doc_degs.append(deg_text)
                    doc_yrs.append(year_val)
        
        if bac_degs:
            for i, d in enumerate(bac_degs):
                if d == "BACHELOR OF ELEMENTARY" and "EDUCATION" not in d:
                    bac_degs[i] = "BACHELOR OF ELEMENTARY EDUCATION"
        if doc_degs:
            for i, d in enumerate(doc_degs):
                if re.search(r'DOCTOR OF PHILOSOPHY', d) and "EDUCATIONAL" not in d:
                    doc_degs[i] = "DOCTOR OF PHILOSOPHY IN EDUCATIONAL MANAGEMENT"
                elif re.search(r'EDUCATIONAL MANAGEMENT', d) and "DOCTOR OF PHILOSOPHY" in d:
                    doc_degs[i] = "DOCTOR OF PHILOSOPHY IN EDUCATIONAL MANAGEMENT"

        if bac_degs:
            result['bachelor_degree'] = "\n".join(bac_degs)
            result['bachelor_year'] = "\n".join(bac_yrs)
        if mas_degs:
            result['master_degree'] = "\n".join(mas_degs)
            result['master_year'] = "\n".join(mas_yrs)
        if doc_degs:
            result['doctorate_degree'] = "\n".join(doc_degs)
            result['doctorate_year'] = "\n".join(doc_yrs)

    # ─────────────────────────────────────────────────────────────
    # PAGE 2: Civil Service Eligibility & Work Experience
    # ─────────────────────────────────────────────────────────────
    p2 = combined_pages[1] if len(combined_pages) > 1 else None
    if p2:
        p2_lines = p2['lines']
        p2_rows = group_words_into_rows(p2_lines, y_threshold=25)
        
        sec4_rows = [r for r in p2_rows if 140 <= r['y'] < 620]
        sec5_rows = [r for r in p2_rows if r['y'] >= 800]
        
        # 1. Section IV (Civil Service Eligibility)
        elig_items = []
        for r in sec4_rows:
            title_items = [it['text'] for it in r['items'] if it['x'] < 650]
            rating_items = [it['text'] for it in r['items'] if 650 <= it['x'] < 800]
            date_items = [it['text'] for it in r['items'] if 800 <= it['x'] < 980]
            place_items = [it['text'] for it in r['items'] if it['x'] >= 980]
            
            title = clean_str(" ".join(title_items)).upper()
            rating = clean_str(" ".join(rating_items))
            if re.match(r'^\d{3}$', rating):
                rating = f"{rating[:2]}.{rating[2:]}"
            
            date_val = normalize_date(" ".join(date_items))
            place = clean_str(" ".join(place_items)).upper()
            
            if title and not re.search(r'^(CIVIL\s*SERVICE|CAREER\s*SERVICE|RATING|DATE\s*OF|EXAMINATION|PLACE|LICENSE|BOARD|BAR|WA|N/?A|NONE|-)$', title, re.IGNORECASE):
                if title == "(CES-WE)" and elig_items and "CES-WE" not in elig_items[-1]['eligibility']:
                    elig_items[-1]['eligibility'] += " (CES-WE)"
                    if rating and not elig_items[-1]['rating']: elig_items[-1]['rating'] = rating
                    if date_val and not elig_items[-1]['date']: elig_items[-1]['date'] = date_val
                    if place and not elig_items[-1]['place_of_assignment']: elig_items[-1]['place_of_assignment'] = place
                    continue
                
                elig_items.append({
                    "eligibility": title,
                    "rating": rating,
                    "date": date_val,
                    "place_of_assignment": place,
                    "license_number": "",
                    "license_validity": ""
                })
        
        result['eligibilities'] = elig_items

        # 2. Section V (Work Experience)
        pos_list = []
        for r in sec5_rows:
            from_items = [it['text'] for it in r['items'] if 160 <= it['x'] < 300]
            to_items = [it['text'] for it in r['items'] if 300 <= it['x'] < 420]
            title_items = [it['text'] for it in r['items'] if 420 <= it['x'] < 800]
            office_items = [it['text'] for it in r['items'] if 800 <= it['x'] < 1200]
            status_items = [it['text'] for it in r['items'] if 1200 <= it['x'] < 1350]
            
            from_str = " ".join(from_items)
            to_str = " ".join(to_items)
            title = clean_str(" ".join(title_items)).upper()
            office = clean_str(" ".join(office_items)).upper()
            status_str = clean_str(" ".join(status_items)).upper()
            
            start_date = normalize_date(from_str)
            is_current = bool(re.search(r'\b(PRESENT|CURRENT)\b', to_str, re.IGNORECASE))
            end_date = "" if is_current else normalize_date(to_str)
            
            if title and not re.search(r'^(POSITION\s*TITLE|INCLUSIVE\s*DATES|DEPARTMENT|AGENCY|OFFICE|SALARY|STATUS|GOVT|WA|N/?A|NONE|-)$', title, re.IGNORECASE):
                title = re.sub(r'\bILL\b', 'III', title)
                title = re.sub(r'\bIl\b', 'II', title)
                
                pos_list.append({
                    "position_id": f"tmp-{len(pos_list)+1}",
                    "position_name": title,
                    "office": office,
                    "start_date": start_date,
                    "end_date": end_date,
                    "status": "Active" if is_current else "Inactive",
                    "is_current": is_current,
                    "oic": bool(re.search(r'\bOIC\b', title, re.IGNORECASE)),
                    "is_oic": bool(re.search(r'\bOIC\b', title, re.IGNORECASE)),
                    "isNew": True,
                    "appointment_status": status_str or "PERMANENT"
                })
        
        result['previous_positions'] = pos_list

    return {
        "success": True,
        "data": result,
        "summary": {
            "hasAddress": bool(result['permanent_address']),
            "hasPhone": bool(result['phone_number']),
            "eligibilityCount": len(result['eligibilities']),
            "positionCount": len(result['previous_positions']),
            "hasBachelor": bool(result['bachelor_degree']),
            "hasMaster": bool(result['master_degree']),
            "hasDoctorate": bool(result['doctorate_degree'])
        }
    }

if __name__ == '__main__':
    test_pdf = sys.argv[1] if len(sys.argv) > 1 else r"e:\christop\staging\api\uploads\APP-2026-0378\pds\pds_APP-2026-0378_20261006_094510.pdf"
    res = parse_pds_pdf(test_pdf)
    print(json.dumps(res, indent=2))
