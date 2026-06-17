export const getOfficialLevel = (item) => {
  const strand = item.strand || item.target_office || '';
  const office = item.office || item.target_office || '';
  const pos = item.position_title || item.target_position || '';

  const isRegionStrand = /^(Region|NCR|CAR|NIR)/i.test(strand);
  if (!isRegionStrand) return 'Central Office';

  const isROOffice = !office || office.toLowerCase() === strand.toLowerCase() || office.toLowerCase().includes('regional office') || office.toLowerCase() === 'ro';
  const isROPosition = /(Regional Director|RD|ARD)/i.test(pos);
  const isSDOPosition = /(Schools Division Superintendent|SDS|ASDS)/i.test(pos);

  if (isSDOPosition) return 'Schools Division Office';
  if (isROOffice || isROPosition) return 'Regional Office';

  return 'Schools Division Office';
};

export const getOfficialRegion = (item) => {
  if (getOfficialLevel(item) === 'Central Office') return 'Central Office';

  const strand = (item.strand || item.target_office || '').trim();
  if (strand.toUpperCase() === 'REGION XIII' || strand.toUpperCase() === 'CARAGA') return 'CARAGA';

  const knownRegions = [
    'Region I', 'Region II', 'Region III', 'Region IV-A', 'Region IV-B',
    'Region V', 'Region VI', 'Region VII', 'Region VIII', 'Region IX',
    'Region X', 'Region XI', 'Region XII', 'NCR', 'CAR', 'NIR', 'BARMM'
  ];

  const found = knownRegions.find(r => r.toLowerCase() === strand.toLowerCase() || strand.toLowerCase().includes(r.toLowerCase()));
  if (found) return found;

  return 'Central Office';
};

export const expandAcronym = (val) => {
  if (!val) return val;
  const upperVal = val.trim().toUpperCase();
  const map = {
    'ASDS': 'Assistant Schools Division Superintendent (ASDS)',
    'ASDS²': 'Assistant Schools Division Superintendent (2)',
    'ASDS³': 'Assistant Schools Division Superintendent (3)',
    'SDS': 'Schools Division Superintendent (SDS)',
    'RD': 'Regional Director (RD)',
    'ARD': 'Assistant Regional Director (ARD)',
    'OIC-ASDS': 'OIC - Assistant Schools Division Superintendent (ASDS)',
    'OIC-SDS': 'OIC - Schools Division Superintendent (SDS)',
    'OIC-RD': 'OIC - Regional Director (RD)',
    'OIC-ARD': 'OIC - Assistant Regional Director (ARD)'
  };
  return map[upperVal] || val;
};
