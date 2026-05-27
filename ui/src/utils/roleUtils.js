export const normalizeRole = (role) => {
    if (!role) return null;
    return role
        .split(/[_\s]+/)
        .map(word => {
            if (word.toLowerCase() === 'deped') return 'DepEd';
            if (word.toLowerCase() === 'efd') return 'EFD';
            if (word.toLowerCase() === 'hrodi') return 'HRODI';
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(' ');
};
