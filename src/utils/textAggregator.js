/**
 * Rakentaa suomenkielisen listan: "A, B ja C"
 */
export const formatFinnishList = (items) => {
    if (!items || items.length === 0) return "";
    if (items.length === 1) return items[0];
    const lastItem = items.pop();
    return `${items.join(", ")} ja ${lastItem}`;
};

/**
 * Aggregoi signaaleihin perustuvat tekstit fraasien metadatan avulla
 */
export const aggregateSignalText = (phrases, activeSignals) => {
    const signalKeys = Object.keys(activeSignals || {});
    const groups = {};
    const templates = {};

    // 1. Erotellaan mallit ja aktiiviset haamufraasit
    phrases.forEach(p => {
        const meta = p.metadata || {};
        
        if (meta.is_template) {
            templates[meta.list_group] = meta.template_format;
        } 
        else if (meta.trigger_signal && signalKeys.includes(meta.trigger_signal)) {
            if (!groups[meta.list_group]) groups[meta.list_group] = [];
            groups[meta.list_group].push(p.base_text);
        }
    });

    // 2. Rakennetaan lauseet ryhmittäin
    const generatedSentences = Object.keys(groups).map(groupKey => {
        const template = templates[groupKey];
        if (!template) return formatFinnishList(groups[groupKey]);
        
        const listText = formatFinnishList(groups[groupKey]);
        return template.replace("{items}", listText);
    });

    return generatedSentences.join(" ");
};