import * as XLSX from 'xlsx';

/**
 * Normalizes dates from various formats (Excel serial number, Date object, string date) to YYYY-MM-DD
 */
export const normalizePDSDate = (val) => {
    if (!val && val !== 0) return '';
    
    // Handle number (Excel serial date number)
    if (typeof val === 'number') {
        if (val <= 0) return '';
        try {
            if (XLSX && XLSX.SSF && typeof XLSX.SSF.parse_date_code === 'function') {
                const parsed = XLSX.SSF.parse_date_code(val);
                if (parsed) {
                    const y = parsed.y || parsed.Y;
                    const m = parsed.m || parsed.M || 1;
                    const d = parsed.d || parsed.D || 1;
                    if (y && y > 1900 && y < 2100) {
                        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    }
                }
            }
        } catch (e) { }

        // Fallback calculation for Excel serial date: 25569 = 1970-01-01
        try {
            if (val > 1000 && val < 60000) {
                const date = new Date(Math.round((val - 25569) * 86400 * 1000));
                if (!isNaN(date.getTime())) {
                    const y = date.getUTCFullYear();
                    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
                    const d = String(date.getUTCDate()).padStart(2, '0');
                    return `${y}-${m}-${d}`;
                }
            }
        } catch (e) { }
    }

    if (val instanceof Date && !isNaN(val.getTime())) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    if (typeof val === 'string') {
        const trimmed = val.trim();
        if (!trimmed || /^(n\/?a|none|present|current|today|to date|now|-)$/i.test(trimmed)) return '';
        
        // Match YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

        // Match MM/DD/YYYY or DD/MM/YYYY
        const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (slashMatch) {
            let [, m, d, y] = slashMatch;
            if (parseInt(m, 10) > 12) {
                const tmp = m; m = d; d = tmp;
            }
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }

        // Match MM-DD-YYYY or DD-MM-YYYY
        const dashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        if (dashMatch) {
            let [, m, d, y] = dashMatch;
            if (parseInt(m, 10) > 12) {
                const tmp = m; m = d; d = tmp;
            }
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }

        // Match plain 4-digit year
        if (/^\d{4}$/.test(trimmed)) {
            return `${trimmed}-01-01`;
        }

        // Try standard JS Date parse
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
            const y = parsed.getFullYear();
            const m = String(parsed.getMonth() + 1).padStart(2, '0');
            const d = String(parsed.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
        return '';
    }

    return '';
};

/**
 * Extracts 4-digit year from date or year string
 */
export const extractYear = (val) => {
    if (!val) return '';
    const str = String(val).trim();
    if (/^\d{4}$/.test(str)) return str;
    const match = str.match(/\b(19\d{2}|20\d{2})\b/);
    if (match) return match[1];
    const normalized = normalizePDSDate(val);
    if (normalized) return normalized.substring(0, 4);
    return '';
};

/**
 * Formats phone number into Philippine 11-digit mobile number format (e.g. 09171234567) or clean phone string
 */
export const normalizePhoneNumber = (raw) => {
    if (!raw) return '';
    let str = String(raw).trim();
    if (/^(n\/?a|none|null|undefined|-)$/i.test(str)) return '';

    // Remove all non-digits except leading +
    str = str.replace(/[^0-9+]/g, '');

    // Convert +639XXXXXXXXX -> 09XXXXXXXXX
    if (str.startsWith('+63')) {
        str = '0' + str.slice(3);
    } else if (str.startsWith('63') && str.length >= 11) {
        str = '0' + str.slice(2);
    } else if (str.length === 10 && str.startsWith('9')) {
        str = '0' + str;
    }

    const digitsOnly = str.replace(/\D/g, '');
    if (digitsOnly.length >= 7) {
        return digitsOnly.slice(0, 11);
    }
    return str;
};

/**
 * Helper to clean text strings from placeholders
 */
const cleanStr = (val) => {
    if (val === undefined || val === null) return '';
    const s = String(val).trim();
    if (/^(n\/?a|none|null|undefined|-)$/i.test(s)) return '';
    return s;
};

/**
 * Checks if a cell contains a pure date or numeric rating/date indicative of a data row
 */
const isDataRowIndicator = (row) => {
    for (let c = 0; c < Math.min(row.length, 5); c++) {
        const val = row[c];
        if (typeof val === 'number' && val > 1000) return true;
        if (typeof val === 'string') {
            if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val.trim())) return true;
            if (/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return true;
        }
    }
    return false;
};

/**
 * Main parser for Personal Data Sheet (CS Form 212 / Excel / CSV / JSON)
 */
export const parsePDSFile = async (fileOrBuffer) => {
    let fileBuffer;
    if (fileOrBuffer instanceof Blob || fileOrBuffer instanceof File) {
        fileBuffer = await fileOrBuffer.arrayBuffer();
    } else if (fileOrBuffer instanceof ArrayBuffer || ArrayBuffer.isView(fileOrBuffer)) {
        fileBuffer = fileOrBuffer;
    } else {
        throw new Error('Unsupported file input: Expected File, Blob, or ArrayBuffer');
    }

    const data = new Uint8Array(fileBuffer);
    const workbook = XLSX.read(data, {
        type: 'array',
        cellDates: true,
        raw: false,
        defval: ''
    });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('The uploaded workbook contains no worksheets.');
    }

    const sheetsGrid = {};
    workbook.SheetNames.forEach(name => {
        const ws = workbook.Sheets[name];
        sheetsGrid[name] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    });

    const result = {
        // 1. Personal Info
        permanent_address: '',
        temporary_address: '',
        phone_number: '',
        alt_contact_details_1: '',
        contact_details: '',
        email: '',
        alt_email_1: '',
        first_name: '',
        last_name: '',
        middle_name: '',
        suffix: '',
        date_of_birth: '',
        civil_status: '',
        gender: '',

        // 2. Eligibility ("Other Civil Service Eligibility")
        eligibilities: [],

        // 3. Previous Positions Held ("Work Experience")
        previous_positions: [],

        // 4. Educational Attainment ("Education")
        bachelor_degree: '',
        bachelor_year: '',
        master_degree: '',
        master_year: '',
        doctorate_degree: '',
        doctorate_year: '',
        other_courses: [],

        // Additional
        trainings: [],
        notable_achievements: []
    };

    const findSheetWithPattern = (pattern) => {
        for (const name of workbook.SheetNames) {
            const grid = sheetsGrid[name];
            if (!grid) continue;
            for (let r = 0; r < Math.min(grid.length, 120); r++) {
                const row = grid[r] || [];
                for (let c = 0; c < row.length; c++) {
                    if (pattern.test(String(row[c] || ''))) {
                        return { sheetName: name, grid, rowIdx: r, colIdx: c };
                    }
                }
            }
        }
        return null;
    };

    // ─────────────────────────────────────────────────────────────
    // 1. PARSE PERSONAL INFORMATION (Address & Phone Number)
    // ─────────────────────────────────────────────────────────────
    for (const sheetName of workbook.SheetNames) {
        const grid = sheetsGrid[sheetName];
        if (!grid || grid.length === 0) continue;

        for (let r = 0; r < grid.length; r++) {
            const row = grid[r] || [];
            for (let c = 0; c < row.length; c++) {
                const cellText = String(row[c] || '').trim();

                // ── Permanent Address ──
                if (/PERMANENT\s*ADDRESS/i.test(cellText) && !result.permanent_address) {
                    const subLabels = [
                        { key: 'house', regex: /^House|^Lot|Block\s*No/i },
                        { key: 'street', regex: /^Street/i },
                        { key: 'subd', regex: /^Subdivision|^Village/i },
                        { key: 'brgy', regex: /^Barangay/i },
                        { key: 'city', regex: /^City|^Municipality/i },
                        { key: 'province', regex: /^Province/i },
                        { key: 'zip', regex: /^ZIP\s*CODE/i }
                    ];

                    const gathered = {};
                    for (let sr = r; sr < Math.min(r + 14, grid.length); sr++) {
                        const sRow = grid[sr] || [];
                        for (let sc = 0; sc < Math.min(c + 12, sRow.length); sc++) {
                            const sText = String(sRow[sc] || '').trim();
                            for (const lbl of subLabels) {
                                if (lbl.regex.test(sText) && !gathered[lbl.key]) {
                                    for (let vc = sc + 1; vc < Math.min(sc + 8, sRow.length); vc++) {
                                        const vText = cleanStr(sRow[vc]);
                                        if (vText && !subLabels.some(l => l.regex.test(vText)) && !/^(residential|permanent)\s*address/i.test(vText)) {
                                            gathered[lbl.key] = vText;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    const addressParts = [];
                    ['house', 'street', 'subd', 'brgy', 'city', 'province'].forEach(k => {
                        if (gathered[k] && !addressParts.includes(gathered[k])) {
                            addressParts.push(gathered[k]);
                        }
                    });

                    if (addressParts.length > 0) {
                        let fullAddress = addressParts.join(', ');
                        if (gathered['zip']) {
                            fullAddress += ` ${gathered['zip']}`;
                        }
                        result.permanent_address = fullAddress.trim();
                    } else {
                        for (let vc = c + 1; vc < Math.min(c + 6, row.length); vc++) {
                            const val = cleanStr(row[vc]);
                            if (val && val.length > 5 && !/address/i.test(val)) {
                                result.permanent_address = val;
                                break;
                            }
                        }
                    }
                }

                // ── Residential Address ──
                if (/RESIDENTIAL\s*ADDRESS/i.test(cellText) && !result.temporary_address) {
                    const subLabels = [
                        { key: 'house', regex: /^House|^Lot|Block\s*No/i },
                        { key: 'street', regex: /^Street/i },
                        { key: 'subd', regex: /^Subdivision|^Village/i },
                        { key: 'brgy', regex: /^Barangay/i },
                        { key: 'city', regex: /^City|^Municipality/i },
                        { key: 'province', regex: /^Province/i },
                        { key: 'zip', regex: /^ZIP\s*CODE/i }
                    ];

                    const gathered = {};
                    for (let sr = r; sr < Math.min(r + 14, grid.length); sr++) {
                        const sRow = grid[sr] || [];
                        for (let sc = 0; sc < Math.min(c + 8, sRow.length); sc++) {
                            const sText = String(sRow[sc] || '').trim();
                            for (const lbl of subLabels) {
                                if (lbl.regex.test(sText) && !gathered[lbl.key]) {
                                    for (let vc = sc + 1; vc < Math.min(sc + 6, sRow.length); vc++) {
                                        const vText = cleanStr(sRow[vc]);
                                        if (vText && !subLabels.some(l => l.regex.test(vText)) && !/permanent/i.test(vText)) {
                                            gathered[lbl.key] = vText;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    const resParts = [];
                    ['house', 'street', 'subd', 'brgy', 'city', 'province'].forEach(k => {
                        if (gathered[k] && !resParts.includes(gathered[k])) {
                            resParts.push(gathered[k]);
                        }
                    });

                    if (resParts.length > 0) {
                        let fullRes = resParts.join(', ');
                        if (gathered['zip']) fullRes += ` ${gathered['zip']}`;
                        result.temporary_address = fullRes.trim();
                    }
                }

                // ── Mobile No. (High priority) ──
                if (/MOBILE\s*NO/i.test(cellText) && !result.phone_number) {
                    for (let vc = c + 1; vc < Math.min(c + 6, row.length); vc++) {
                        const val = cleanStr(row[vc]);
                        if (val) {
                            const cleanedPhone = normalizePhoneNumber(val);
                            if (cleanedPhone) {
                                result.phone_number = cleanedPhone;
                                result.alt_contact_details_1 = cleanedPhone;
                                result.contact_details = cleanedPhone;
                                break;
                            }
                        }
                    }
                }

                // ── Telephone No. (Fallback if mobile not set) ──
                if (/TELEPHONE\s*NO/i.test(cellText) && !result.phone_number) {
                    for (let vc = c + 1; vc < Math.min(c + 6, row.length); vc++) {
                        const val = cleanStr(row[vc]);
                        if (val) {
                            const cleanedPhone = normalizePhoneNumber(val);
                            if (cleanedPhone) {
                                result.phone_number = cleanedPhone;
                                result.alt_contact_details_1 = cleanedPhone;
                                result.contact_details = cleanedPhone;
                                break;
                            }
                        }
                    }
                }

                // ── Email Address ──
                if (/E-?MAIL\s*ADDRESS/i.test(cellText) && !result.email) {
                    for (let vc = c + 1; vc < Math.min(c + 6, row.length); vc++) {
                        const val = cleanStr(row[vc]);
                        if (val && /\S+@\S+\.\S+/.test(val)) {
                            result.email = val;
                            break;
                        }
                    }
                }

                // ── Date of Birth ──
                if (/DATE\s*OF\s*BIRTH/i.test(cellText) && !result.date_of_birth) {
                    for (let vc = c + 1; vc < Math.min(c + 6, row.length); vc++) {
                        const val = row[vc];
                        const normDate = normalizePDSDate(val);
                        if (normDate) {
                            result.date_of_birth = normDate;
                            break;
                        }
                    }
                }

                // ── Civil Status ──
                if (/CIVIL\s*STATUS/i.test(cellText) && !result.civil_status) {
                    for (let vc = c + 1; vc < Math.min(c + 6, row.length); vc++) {
                        const val = cleanStr(row[vc]);
                        if (val && /^(Single|Married|Widowed|Separated|Other)/i.test(val)) {
                            result.civil_status = val.toUpperCase();
                            break;
                        }
                    }
                }

                // ── Sex / Gender ──
                if (/^SEX/i.test(cellText) && !result.gender) {
                    for (let vc = c + 1; vc < Math.min(c + 6, row.length); vc++) {
                        const val = cleanStr(row[vc]);
                        if (val && /^(Male|Female)/i.test(val)) {
                            result.gender = val.toUpperCase();
                            break;
                        }
                    }
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 2. PARSE CIVIL SERVICE ELIGIBILITY ("Other Civil Service Eligibility")
    // ─────────────────────────────────────────────────────────────
    const eligSheetMatch = findSheetWithPattern(/IV\.\s*CIVIL\s*SERVICE\s*ELIGIBILITY|CAREER\s*SERVICE.*RA\s*1080/i);
    if (eligSheetMatch) {
        const { grid, rowIdx: startRow } = eligSheetMatch;
        let lastHeaderRow = startRow;
        let nameCol = 0, ratingCol = 1, dateCol = 2, placeCol = 3;

        for (let r = startRow; r < Math.min(startRow + 3, grid.length); r++) {
            const row = grid[r] || [];
            if (isDataRowIndicator(row)) break;

            for (let c = 0; c < row.length; c++) {
                const text = String(row[c] || '').trim();
                if (/^(CAREER\s*SERVICE|RA\s*1080|ELIGIBILITY)/i.test(text)) {
                    nameCol = c;
                    lastHeaderRow = Math.max(lastHeaderRow, r);
                }
                if (/^RATING/i.test(text)) {
                    ratingCol = c;
                    lastHeaderRow = Math.max(lastHeaderRow, r);
                }
                if (/^DATE\s*OF\s*(EXAM|CONF)/i.test(text) || (/^DATE\s*OF/i.test(text) && !/VALIDITY/i.test(text))) {
                    dateCol = c;
                    lastHeaderRow = Math.max(lastHeaderRow, r);
                }
                if (/^PLACE\s*OF/i.test(text)) {
                    placeCol = c;
                    lastHeaderRow = Math.max(lastHeaderRow, r);
                }
            }
        }

        const dataStartRow = lastHeaderRow + 1;
        const eligList = [];

        for (let r = dataStartRow; r < grid.length; r++) {
            const row = grid[r] || [];
            const firstFewCells = row.slice(0, 10).map(x => String(x || '').trim()).join(' ');

            if (/V\.\s*WORK\s*EXPERIENCE/i.test(firstFewCells) || /VI\.\s*VOLUNTARY/i.test(firstFewCells)) {
                break;
            }

            let eligName = cleanStr(row[nameCol]);
            if (!eligName) {
                for (let c = 0; c < Math.min(4, row.length); c++) {
                    const testVal = cleanStr(row[c]);
                    if (testVal && !/^(CAREER\s*SERVICE\/|RATING|DATE\s*OF|PLACE\s*OF|LICENSE|N\/?A|NONE|-)$/i.test(testVal) && !/^\d+$/.test(testVal) && !normalizePDSDate(testVal)) {
                        eligName = testVal;
                        break;
                    }
                }
            }

            if (!eligName || /^(CAREER\s*SERVICE\/|RATING|DATE\s*OF|PLACE\s*OF|LICENSE|N\/?A|NONE|\(Continue|-)$/i.test(eligName)) {
                continue;
            }

            let rating = '';
            if (ratingCol !== -1 && row[ratingCol] !== undefined) {
                rating = cleanStr(row[ratingCol]);
            }
            if (!rating) {
                for (let c = 1; c < row.length; c++) {
                    const testVal = cleanStr(row[c]);
                    if (/^\d{2}(\.\d{1,4})?%?$/.test(testVal) || /^PASSED$/i.test(testVal)) {
                        rating = testVal;
                        break;
                    }
                }
            }

            let examDate = '';
            if (dateCol !== -1 && row[dateCol] !== undefined) {
                examDate = normalizePDSDate(row[dateCol]);
            }
            if (!examDate) {
                for (let c = 1; c < row.length; c++) {
                    const testDate = normalizePDSDate(row[c]);
                    if (testDate) {
                        examDate = testDate;
                        break;
                    }
                }
            }

            let place = '';
            if (placeCol !== -1 && row[placeCol] !== undefined) {
                place = cleanStr(row[placeCol]);
            }
            if (!place) {
                for (let c = (dateCol !== -1 ? dateCol + 1 : 3); c < Math.min(dateCol + 4, row.length); c++) {
                    const testPlace = cleanStr(row[c]);
                    if (testPlace && testPlace !== rating && !/^\d+$/.test(testPlace) && !normalizePDSDate(testPlace)) {
                        place = testPlace;
                        break;
                    }
                }
            }

            eligList.push({
                eligibility: eligName.toUpperCase(),
                rating: rating ? rating.replace('%', '') : '',
                date: examDate,
                place_of_assignment: place ? place.toUpperCase() : ''
            });
        }

        if (eligList.length > 0) {
            result.eligibilities = eligList;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 3. PARSE PREVIOUS POSITIONS HELD ("Work Experience")
    // ─────────────────────────────────────────────────────────────
    const workSheetMatch = findSheetWithPattern(/V\.\s*WORK\s*EXPERIENCE|INCLUSIVE\s*DATES.*POSITION\s*TITLE/i);
    if (workSheetMatch) {
        const { grid, rowIdx: startRow } = workSheetMatch;
        let lastHeaderRow = startRow;
        let fromCol = 0, toCol = 1, posCol = 2, officeCol = 3, sgCol = 5;

        for (let r = startRow; r < Math.min(startRow + 3, grid.length); r++) {
            const row = grid[r] || [];
            if (isDataRowIndicator(row)) break;

            for (let c = 0; c < row.length; c++) {
                const text = String(row[c] || '').trim();
                if (/^FROM$/i.test(text)) {
                    fromCol = c;
                    lastHeaderRow = Math.max(lastHeaderRow, r);
                } else if (/^INCLUSIVE/i.test(text)) {
                    fromCol = c;
                    lastHeaderRow = Math.max(lastHeaderRow, r);
                }
                if (/^TO$/i.test(text)) {
                    toCol = c;
                    lastHeaderRow = Math.max(lastHeaderRow, r);
                }
                if (/^POSITION\s*TITLE/i.test(text)) {
                    posCol = c;
                    lastHeaderRow = Math.max(lastHeaderRow, r);
                }
                if (/^DEPARTMENT|^AGENCY|^OFFICE/i.test(text)) {
                    officeCol = c;
                    lastHeaderRow = Math.max(lastHeaderRow, r);
                }
                if (/^SALARY|^PAY\s*GRADE|^SG/i.test(text)) {
                    sgCol = c;
                    lastHeaderRow = Math.max(lastHeaderRow, r);
                }
            }
        }

        if (fromCol !== -1 && toCol === -1) {
            toCol = fromCol + 1;
        }

        const dataStartRow = lastHeaderRow + 1;
        const posList = [];

        for (let r = dataStartRow; r < grid.length; r++) {
            const row = grid[r] || [];
            const firstFewCells = row.slice(0, 10).map(x => String(x || '').trim()).join(' ');

            if (/VI\.\s*VOLUNTARY/i.test(firstFewCells) || /VII\.\s*LEARNING/i.test(firstFewCells)) {
                break;
            }

            let posTitle = posCol !== -1 ? cleanStr(row[posCol]) : '';
            if (!posTitle) {
                for (let c = 2; c < Math.min(6, row.length); c++) {
                    const testVal = cleanStr(row[c]);
                    if (testVal && !/^(FROM|TO|POSITION|DEPARTMENT|N\/?A|NONE|\(Continue|-)$/i.test(testVal) && !normalizePDSDate(testVal) && isNaN(Number(testVal))) {
                        posTitle = testVal;
                        break;
                    }
                }
            }

            if (!posTitle || /^(FROM|TO|POSITION\s*TITLE|DEPARTMENT|MONTHLY|SALARY|N\/?A|NONE|\(Continue|-)$/i.test(posTitle)) {
                continue;
            }

            let fromVal = fromCol !== -1 ? row[fromCol] : '';
            let toVal = toCol !== -1 ? row[toCol] : '';

            if (!fromVal) {
                for (let c = 0; c < Math.min(4, row.length); c++) {
                    const d = normalizePDSDate(row[c]);
                    if (d) { fromVal = d; break; }
                }
            }

            const startDate = normalizePDSDate(fromVal);
            const toStr = String(toVal || '').trim();
            const isCurrent = /^(present|current|today|to date|now)$/i.test(toStr) || (!toStr && Boolean(startDate));
            const endDate = isCurrent ? '' : normalizePDSDate(toVal);

            let office = officeCol !== -1 ? cleanStr(row[officeCol]) : '';
            if (!office) {
                for (let c = (posCol !== -1 ? posCol + 1 : 3); c < Math.min((posCol !== -1 ? posCol + 4 : 7), row.length); c++) {
                    const testVal = cleanStr(row[c]);
                    if (testVal && testVal !== posTitle && isNaN(Number(testVal)) && !normalizePDSDate(testVal)) {
                        office = testVal;
                        break;
                    }
                }
            }

            let salaryGrade = '';
            if (sgCol !== -1 && row[sgCol] !== undefined) {
                const sgRaw = cleanStr(row[sgCol]);
                const sgMatch = sgRaw.match(/\b([1-3]?[0-9])\b/);
                if (sgMatch) salaryGrade = sgMatch[1];
            }
            if (!salaryGrade) {
                for (let c = 0; c < row.length; c++) {
                    const val = String(row[c] || '').trim();
                    const match = val.match(/^SG\s*([1-3]?[0-9])/i) || val.match(/^([1-3][0-9])(-\d+)?$/);
                    if (match) {
                        salaryGrade = match[1];
                        break;
                    }
                }
            }

            posList.push({
                id: Date.now() + posList.length,
                position_name: posTitle.toUpperCase(),
                office: office ? office.toUpperCase() : '',
                start_date: startDate,
                end_date: endDate,
                is_current: isCurrent,
                salary_grade: salaryGrade,
                status: isCurrent ? 'Active' : 'Inactive',
                oic_positions: []
            });
        }

        if (posList.length > 0) {
            result.previous_positions = posList;
        }
    }

    // ─────────────────────────────────────────────────────────────
    // 4. PARSE EDUCATIONAL ATTAINMENT ("Education")
    // ─────────────────────────────────────────────────────────────
    const eduSheetMatch = findSheetWithPattern(/III\.\s*EDUCATIONAL\s*BACKGROUND|ELEMENTARY.*SECONDARY.*COLLEGE/i);
    if (eduSheetMatch) {
        const { grid, rowIdx: startRow } = eduSheetMatch;
        const bachelorDegs = [];
        const bachelorYrs = [];
        const masterDegs = [];
        const masterYrs = [];
        const doctorateDegs = [];
        const doctorateYrs = [];
        const otherCourses = [];

        let levelCol = 0, schoolCol = -1, degreeCol = -1, yearCol = -1, toCol = -1;

        for (let r = startRow; r < Math.min(startRow + 3, grid.length); r++) {
            const row = grid[r] || [];
            if (isDataRowIndicator(row)) break;

            for (let c = 0; c < row.length; c++) {
                const text = String(row[c] || '').trim();
                if (/^LEVEL/i.test(text) && levelCol === 0) levelCol = c;
                if (/^NAME\s*OF\s*SCHOOL/i.test(text) && schoolCol === -1) schoolCol = c;
                if (/^BASIC\s*EDUCATION|^DEGREE|^COURSE/i.test(text) && degreeCol === -1) degreeCol = c;
                if (/^YEAR\s*GRADUATED/i.test(text) && yearCol === -1) yearCol = c;
                if (/^TO$/i.test(text) && toCol === -1) toCol = c;
            }
        }

        for (let r = startRow + 1; r < grid.length; r++) {
            const row = grid[r] || [];
            const rowText = row.map(x => String(x || '').trim()).join(' ');

            if (/IV\.\s*CIVIL\s*SERVICE/i.test(rowText) || /V\.\s*WORK\s*EXPERIENCE/i.test(rowText)) {
                break;
            }

            const levelText = String(row[levelCol] || row[0] || '').trim().toUpperCase();
            
            let degreeName = degreeCol !== -1 ? cleanStr(row[degreeCol]) : '';
            if (!degreeName) {
                for (let c = 1; c < Math.min(6, row.length); c++) {
                    const testVal = cleanStr(row[c]);
                    if (testVal && !/^(ELEMENTARY|SECONDARY|COLLEGE|GRADUATE|VOCATIONAL|LEVEL|NAME|BASIC|N\/?A|NONE|-)$/i.test(testVal) && isNaN(Number(testVal))) {
                        degreeName = testVal;
                        break;
                    }
                }
            }

            let year = yearCol !== -1 ? extractYear(row[yearCol]) : '';
            if (!year && toCol !== -1) {
                year = extractYear(row[toCol]);
            }
            if (!year) {
                for (let c = 2; c < row.length; c++) {
                    const yr = extractYear(row[c]);
                    if (yr && parseInt(yr, 10) >= 1950 && parseInt(yr, 10) <= 2030) {
                        year = yr;
                        break;
                    }
                }
            }

            if (/COLLEGE|BACCALAUREATE|BACHELOR/i.test(levelText) || /BACHELOR|B\.S\.|B\.A\.|AB\s+|BS\s+/i.test(degreeName)) {
                if (degreeName && !bachelorDegs.includes(degreeName)) {
                    bachelorDegs.push(degreeName);
                    bachelorYrs.push(year || '');
                }
            } else if (/GRADUATE\s*STUDIES|POST\s*GRADUATE|MASTER|DOCTOR/i.test(levelText) || /MASTER|DOCTOR|PH\.?D|ED\.?D|DPA|MAED|MBA|MPA|MAT/i.test(degreeName)) {
                if (degreeName) {
                    if (/DOCTOR|PH\.?D|ED\.?D|DPA|DOCTORATE/i.test(degreeName)) {
                        if (!doctorateDegs.includes(degreeName)) {
                            doctorateDegs.push(degreeName);
                            doctorateYrs.push(year || '');
                        }
                    } else {
                        if (!masterDegs.includes(degreeName)) {
                            masterDegs.push(degreeName);
                            masterYrs.push(year || '');
                        }
                    }
                }
            } else if (/VOCATIONAL|TRADE/i.test(levelText)) {
                if (degreeName) {
                    otherCourses.push({
                        course: degreeName,
                        details: schoolCol !== -1 ? cleanStr(row[schoolCol]) : '',
                        date_from: '',
                        date_to: year ? `${year}-01-01` : ''
                    });
                }
            }
        }

        if (bachelorDegs.length > 0) {
            result.bachelor_degree = bachelorDegs.join('\n');
            result.bachelor_year = bachelorYrs.join('\n');
        }
        if (masterDegs.length > 0) {
            result.master_degree = masterDegs.join('\n');
            result.master_year = masterYrs.join('\n');
        }
        if (doctorateDegs.length > 0) {
            result.doctorate_degree = doctorateDegs.join('\n');
            result.doctorate_year = doctorateYrs.join('\n');
        }
        if (otherCourses.length > 0) {
            result.other_courses = otherCourses;
        }
    }

    return {
        success: true,
        data: result,
        summary: {
            hasAddress: Boolean(result.permanent_address),
            hasPhone: Boolean(result.phone_number),
            eligibilityCount: (result.eligibilities || []).length,
            positionCount: (result.previous_positions || []).length,
            hasBachelor: Boolean(result.bachelor_degree),
            hasMaster: Boolean(result.master_degree),
            hasDoctorate: Boolean(result.doctorate_degree)
        }
    };
};
