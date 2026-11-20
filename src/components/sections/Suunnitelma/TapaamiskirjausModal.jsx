import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ClipboardCheck, Copy, CheckCircle, RotateCcw, Calendar } from 'lucide-react';
import Modal from '../../common/Modal';
import Button from '../../common/Button';

const ModalCheckbox = ({ label, checked, onChange }) => (
    <label
        style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem',
            cursor: 'pointer',
            fontSize: '0.92rem',
            lineHeight: '1.4',
            color: 'var(--color-text-primary)',
            userSelect: 'none',
            padding: '0.2rem 0'
        }}
    >
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            style={{
                width: '18px',
                height: '18px',
                minWidth: '18px',
                margin: '2px 0 0 0',
                flexShrink: 0,
                cursor: 'pointer',
                accentColor: 'var(--color-primary)'
            }}
        />
        <span>{label}</span>
    </label>
);

const muotoilePvm = (dateString) => {
    if (!dateString) return null;
    const cleanDate = String(dateString).split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length !== 3) return dateString;
    return `${parseInt(parts[2], 10)}.${parseInt(parts[1], 10)}.${parts[0]}`;
};

const paatteleOletusTapa = (service) => {
    if (service.service_type === 'koulutus') {
        return 'itsenainen';
    }
    const planText = (service.plan_text || '').toLowerCase().trim();
    if (
        planText.startsWith('asiakas hakee') ||
        planText.startsWith('asiakas hakeutuu') ||
        planText.includes('hakee itsenäisesti') ||
        planText.includes('hakeutuu itsenäisesti')
    ) {
        return 'itsenainen';
    }
    return 'ohjataan';
};

const onkoKattolause = (label) => {
    const lower = String(label || '').toLowerCase();
    return lower.includes('kattolause') || lower.includes('palvelutarpeen arviointi');
};

const siivoaToimenpideNimi = (label) => {
    return String(label || '')
        .replace(/\s*\((?:kattolause|asiakas|asiantuntija|viranomainen|sisäinen)\)/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\.$/, '');
};

const muotoilePieneksiAlkukirjaimeksi = (teksti) => {
    if (!teksti) return '';
    // Säilytetään isolla, jos alku on lyhenne (esim. CV, TE, TUVA)
    if (teksti.length >= 2 && teksti[0] === teksti[0].toUpperCase() && teksti[1] === teksti[1].toUpperCase()) {
        return teksti;
    }
    return teksti.charAt(0).toLowerCase() + teksti.slice(1);
};

const yhdistaLuettelo = (items) => {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0];
    const viimeinen = items[items.length - 1];
    const alku = items.slice(0, -1).join(', ');
    const konjunktio = items.some(item => item.includes(' ja ')) ? ' sekä ' : ' ja ';
    return `${alku}${konjunktio}${viimeinen}`;
};

const muodostaPalveluLause = (items, mode) => {
    if (items.length === 0) return null;

    const koulutukset = items.filter(i => i.isKoulutus);
    const palvelut = items.filter(i => !i.isKoulutus);

    const muotoileNimi = (item) => {
        const pvm = item.deadline ? muotoilePvm(item.deadline) : null;
        return pvm ? `${item.title} (hakuaika päättyy ${pvm})` : item.title;
    };

    const palveluTeksti = palvelut.length > 0
        ? `${palvelut.length === 1 ? 'palveluun' : 'palveluihin'} ${yhdistaLuettelo(palvelut.map(muotoileNimi))}`
        : null;

    const koulutusTeksti = koulutukset.length > 0
        ? `${koulutukset.length === 1 ? 'koulutukseen' : 'koulutuksiin'} ${yhdistaLuettelo(koulutukset.map(muotoileNimi))}`
        : null;

    if (mode === 'ohjataan') {
        const osat = [palveluTeksti, koulutusTeksti].filter(Boolean);
        return `Asiakas ohjataan ${yhdistaLuettelo(osat)}.`;
    }

    if (koulutusTeksti && palveluTeksti) {
        return `Asiakas hakee itsenäisesti ${koulutusTeksti} ja hakeutuu ${palveluTeksti}.`;
    }
    if (koulutusTeksti) {
        return `Asiakas hakee itsenäisesti ${koulutusTeksti}.`;
    }
    return `Asiakas hakeutuu itsenäisesti ${palveluTeksti}.`;
};

const TapaamiskirjausModal = ({
    isOpen,
    onClose,
    activeServices = [],
    activePhrases = [],
    jatkuvatPalvelut = [],
    activeSignals = {},
    savedText = '',
    onSaveText
}) => {
    const [serviceItems, setServiceItems] = useState([]);
    const [phraseItems, setPhraseItems] = useState([]);
    const [options, setOptions] = useState({
        palvelutarveArvioitu: true,
        tyonhakuprofiili: false,
        jatkuvatPalvelut: false,
        seuraavaYhteydenotto: false
    });

    const [text, setText] = useState(savedText || '');
    const [isManuallyEdited, setIsManuallyEdited] = useState(false);
    const [copied, setCopied] = useState(false);

    const wasOpenRef = useRef(false);
    const onSaveTextRef = useRef(onSaveText);
    const lastSavedRef = useRef(savedText);

    useEffect(() => {
        onSaveTextRef.current = onSaveText;
    }, [onSaveText]);

    useEffect(() => {
        lastSavedRef.current = savedText;
    }, [savedText]);

    const saveToState = (nextText) => {
        if (typeof onSaveTextRef.current === 'function' && lastSavedRef.current !== nextText) {
            lastSavedRef.current = nextText;
            onSaveTextRef.current(nextText);
        }
    };

    const hasTuettuProfiili = useMemo(() => {
        return !!activeSignals?.tm_profiili_tuettu;
    }, [activeSignals]);

    const hasAnyProfiiliSignal = useMemo(() => {
        return Object.entries(activeSignals || {}).some(
            ([key, val]) => val && key.startsWith('tm_profiili')
        );
    }, [activeSignals]);

    // Alustetaan valinnat vain silloin kun modaali siirtyy kiinni -> auki
    useEffect(() => {
        if (isOpen && !wasOpenRef.current) {
            setServiceItems(
                activeServices.map(service => ({
                    id: service.id,
                    title: service.title,
                    isKoulutus: service.service_type === 'koulutus',
                    deadline: service.enrollment_deadline || null,
                    included: true,
                    mode: paatteleOletusTapa(service)
                }))
            );

            setPhraseItems(
                activePhrases.map(phrase => {
                    const rawLabel = phrase.lyhenne || phrase.id;
                    const cleanLabel = siivoaToimenpideNimi(rawLabel);
                    return {
                        id: phrase.id,
                        label: cleanLabel || rawLabel,
                        included: !onkoKattolause(rawLabel)
                    };
                })
            );

            setOptions({
                palvelutarveArvioitu: true,
                tyonhakuprofiili: hasAnyProfiiliSignal,
                jatkuvatPalvelut: jatkuvatPalvelut.length > 0,
                seuraavaYhteydenotto: false
            });

            if (savedText && savedText.trim().length > 0) {
                setText(savedText);
                setIsManuallyEdited(true);
            } else {
                setIsManuallyEdited(false);
            }

            setCopied(false);
        }
        wasOpenRef.current = isOpen;
    }, [isOpen, activeServices, activePhrases, jatkuvatPalvelut, hasAnyProfiiliSignal, savedText]);

    const autoGeneratedText = useMemo(() => {
        const sentences = [];

        if (options.palvelutarveArvioitu) {
            sentences.push('Asiakkaan palvelutarve on arvioitu ja työllistymissuunnitelma päivitetty.');
        }

        const includedServices = serviceItems.filter(item => item.included);
        const ohjattavat = includedServices.filter(item => item.mode === 'ohjataan');
        const itsenaiset = includedServices.filter(item => item.mode === 'itsenainen');

        const ohjausLause = muodostaPalveluLause(ohjattavat, 'ohjataan');
        const itsenainenLause = muodostaPalveluLause(itsenaiset, 'itsenainen');

        if (ohjausLause) sentences.push(ohjausLause);
        if (itsenainenLause) sentences.push(itsenainenLause);

        const selectedPhraseLabels = phraseItems
            .filter(p => p.included)
            .map(p => muotoilePieneksiAlkukirjaimeksi(siivoaToimenpideNimi(p.label)))
            .filter(Boolean);

        if (selectedPhraseLabels.length > 0) {
            const alku = includedServices.length > 0 ? 'Lisäksi sovittiin' : 'Tapaamisessa sovittiin';
            const muoto = selectedPhraseLabels.length === 1 ? 'jatkotoimeksi' : 'jatkotoimiksi';
            sentences.push(`${alku} ${muoto} ${yhdistaLuettelo(selectedPhraseLabels)}.`);
        }

        if (options.tyonhakuprofiili) {
            if (hasTuettuProfiili) {
                sentences.push('Sovittiin tuesta työnhakuprofiilin laatimiseen Työmarkkinatorilla.');
            } else {
                sentences.push('Sovittiin työnhakuprofiilin laatimisesta ja julkaisemisesta Työmarkkinatorilla.');
            }
        }

        if (options.jatkuvatPalvelut && jatkuvatPalvelut.length > 0) {
            sentences.push('Asiakas jatkaa myös aiemmin sovituissa palveluissa.');
        }

        if (options.seuraavaYhteydenotto) {
            sentences.push('Seuraavasta yhteydenotosta on sovittu yhdessä.');
        }

        return sentences.join(' ');
    }, [serviceItems, phraseItems, options, hasTuettuProfiili, jatkuvatPalvelut.length]);

    // Päivitetään tekstikenttä ja tallennetaan stateen, kun modaali on auki eikä tekstiä ole lukittu käsinmuokkaukseen
    useEffect(() => {
        if (isOpen && !isManuallyEdited) {
            setText(autoGeneratedText);
            saveToState(autoGeneratedText);
        }
    }, [isOpen, autoGeneratedText, isManuallyEdited]);

    const handleToggleServiceIncluded = (id, isChecked) => {
        setIsManuallyEdited(false);
        setServiceItems(prev =>
            prev.map(item => (item.id === id ? { ...item, included: isChecked } : item))
        );
    };

    const handleChangeServiceMode = (id, mode) => {
        setIsManuallyEdited(false);
        setServiceItems(prev =>
            prev.map(item => (item.id === id ? { ...item, mode } : item))
        );
    };

    const handleTogglePhraseIncluded = (id, isChecked) => {
        setIsManuallyEdited(false);
        setPhraseItems(prev =>
            prev.map(item => (item.id === id ? { ...item, included: isChecked } : item))
        );
    };

    const handleToggleOption = (key, isChecked) => {
        setIsManuallyEdited(false);
        setOptions(prev => ({ ...prev, [key]: isChecked }));
    };

    const handleManualTextChange = (e) => {
        const nextText = e.target.value;
        setText(nextText);
        setIsManuallyEdited(true);
        saveToState(nextText);
    };

    const handleResetToAuto = () => {
        setIsManuallyEdited(false);
        setText(autoGeneratedText);
        saveToState(autoGeneratedText);
    };

    const handleCopy = async () => {
        if (!text.trim()) return;
        saveToState(text);
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        } catch (err) {
            console.error('Kopiointi leikepöydälle epäonnistui:', err);
        }
    };

    const hasNoSelections = serviceItems.length === 0 && phraseItems.length === 0;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Tapaamiskirjaus asiakkaalle"
            icon={ClipboardCheck}
            maxWidth="820px"
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        Sulje
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleCopy}
                        disabled={!text.trim()}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                        {copied ? 'Kopioitu leikepöydälle!' : 'Kopioi kirjaus'}
                    </Button>
                </>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
                    Kokoa napakka ja asiakasystävällinen yhteenveto tapaamisesta. Kirjaus tallentuu automaattisesti jälkiviestintää varten.
                </p>

                {/* 1. PERUSVALINNAT */}
                <div className="card-inner" style={{ padding: '1rem 1.25rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
                        Tapaamisen perusrivit
                    </h4>
                    <div className="grid-cols-2-tight">
                        <ModalCheckbox
                            label="Palvelutarve arvioitu ja suunnitelma päivitetty"
                            checked={options.palvelutarveArvioitu}
                            onChange={(isChecked) => handleToggleOption('palvelutarveArvioitu', isChecked)}
                        />
                        <ModalCheckbox
                            label="Työnhakuprofiilin laatiminen Työmarkkinatorilla"
                            checked={options.tyonhakuprofiili}
                            onChange={(isChecked) => handleToggleOption('tyonhakuprofiili', isChecked)}
                        />
                        {jatkuvatPalvelut.length > 0 && (
                            <ModalCheckbox
                                label="Jatkaa aiemmin sovituissa palveluissa"
                                checked={options.jatkuvatPalvelut}
                                onChange={(isChecked) => handleToggleOption('jatkuvatPalvelut', isChecked)}
                            />
                        )}
                        <ModalCheckbox
                            label="Sovittu seuraavasta yhteydenotosta"
                            checked={options.seuraavaYhteydenotto}
                            onChange={(isChecked) => handleToggleOption('seuraavaYhteydenotto', isChecked)}
                        />
                    </div>
                </div>

                {/* 2. VALITUT PALVELUT JA KOULUTUKSET */}
                {serviceItems.length > 0 && (
                    <div>
                        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
                            Valitut palvelut ja koulutukset
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {serviceItems.map(item => (
                                <div
                                    key={item.id}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: '1rem',
                                        flexWrap: 'wrap',
                                        padding: '0.75rem 1rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--color-border)',
                                        backgroundColor: item.included ? '#ffffff' : '#f8fafc',
                                        opacity: item.included ? 1 : 0.65
                                    }}
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1, minWidth: '220px' }}>
                                        <ModalCheckbox
                                            label={item.title}
                                            checked={item.included}
                                            onChange={(isChecked) => handleToggleServiceIncluded(item.id, isChecked)}
                                        />
                                        {item.deadline && (
                                            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', paddingLeft: '1.75rem' }}>
                                                <Calendar size={12} /> Hakuaika päättyy {muotoilePvm(item.deadline)}
                                            </span>
                                        )}
                                    </div>

                                    {item.included && (
                                        <div style={{ display: 'inline-flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                                            <button
                                                type="button"
                                                onClick={() => handleChangeServiceMode(item.id, 'ohjataan')}
                                                style={{
                                                    padding: '0.35rem 0.75rem',
                                                    fontSize: '0.82rem',
                                                    fontWeight: item.mode === 'ohjataan' ? 600 : 400,
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    backgroundColor: item.mode === 'ohjataan' ? 'var(--color-primary)' : '#f8fafc',
                                                    color: item.mode === 'ohjataan' ? '#ffffff' : 'var(--color-text-secondary)'
                                                }}
                                            >
                                                Asiakas ohjataan
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleChangeServiceMode(item.id, 'itsenainen')}
                                                style={{
                                                    padding: '0.35rem 0.75rem',
                                                    fontSize: '0.82rem',
                                                    fontWeight: item.mode === 'itsenainen' ? 600 : 400,
                                                    border: 'none',
                                                    borderLeft: '1px solid var(--color-border)',
                                                    cursor: 'pointer',
                                                    backgroundColor: item.mode === 'itsenainen' ? 'var(--color-primary)' : '#f8fafc',
                                                    color: item.mode === 'itsenainen' ? '#ffffff' : 'var(--color-text-secondary)'
                                                }}
                                            >
                                                Hakee itsenäisesti
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. MUUT SOVITUT TOIMENPITEET (KÄSIOHJAUS) */}
                {phraseItems.length > 0 && (
                    <div className="card-inner" style={{ padding: '1rem 1.25rem' }}>
                        <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
                            Muut sovitut toimenpiteet
                        </h4>
                        <div className="grid-cols-2-tight">
                            {phraseItems.map(phrase => (
                                <ModalCheckbox
                                    key={phrase.id}
                                    label={phrase.label}
                                    checked={phrase.included}
                                    onChange={(isChecked) => handleTogglePhraseIncluded(phrase.id, isChecked)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {hasNoSelections && (
                    <div style={{ padding: '0.85rem 1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed var(--color-border)', fontSize: '0.88rem', color: 'var(--color-text-secondary)' }}>
                        Suunnitelmaan ei ole vielä valittu palveluita tai toimenpiteitä. Voit silti käyttää perusrivejä ja täydentää kirjausta vapaasti alla.
                    </div>
                )}

                {/* 4. MUOKATTAVA ESIAKATSELU */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <label htmlFor="tapaamiskirjaus-textarea" style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-text-primary)' }}>
                            Valmis kirjaus (muokattavissa)
                        </label>
                        {isManuallyEdited && text !== autoGeneratedText && (
                            <button
                                type="button"
                                onClick={handleResetToAuto}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--color-primary)',
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                    fontWeight: 500
                                }}
                            >
                                <RotateCcw size={14} /> Päivitä luonnos valinnoista
                            </button>
                        )}
                    </div>
                    <textarea
                        id="tapaamiskirjaus-textarea"
                        rows={6}
                        value={text}
                        onChange={handleManualTextChange}
                        style={{
                            width: '100%',
                            padding: '0.9rem 1rem',
                            borderRadius: '8px',
                            border: '1px solid var(--color-border)',
                            fontFamily: 'var(--font-sans)',
                            fontSize: '0.95rem',
                            lineHeight: '1.6',
                            resize: 'vertical'
                        }}
                    />
                </div>
            </div>
        </Modal>
    );
};

export default TapaamiskirjausModal;