const crypto = require('crypto');
function canonicalizationID(id1, id2) {
    if (!id1 || !id2) {
        throw new Error('Both ids are required');
    }

    const canonical = [id1, id2].sort().join('|');

    return crypto
        .createHash('sha256')
        .update(canonical)
        .digest('hex');
}

module.exports = { canonicalizationID };