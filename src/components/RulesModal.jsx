import React from 'react';

const RulesModal = ({ onClose }) => {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-button" onClick={onClose}>&times;</button>
                <h2>Työnhakukeskustelujen Malli (Laki julkisista työvoimapalveluista 31-33 §)</h2>
                
                <div className="rule-section">
                    <h3>Alkuhaastattelu</h3>
                    <p>Järjestetään 5 arkipäivän kuluessa työnhaun alkamisesta.</p>
                </div>

                <div className="rule-section">
                    <h3>Tehostettu aloitusjakso</h3>
                    <p>Alkuhaastattelun jälkeen järjestetään **viisi (5) täydentävää työnhakukeskustelua** lähtökohtaisesti kahden viikon välein. Tämä kattaa noin 2,5 kuukauden jakson.</p>
                    <p><strong>Koskee:</strong> Työttömiä ja työttömyysuhan alaisia työnhakijoita (ei koske lomautettuja, elleivät he itse pyydä).</p>
                </div>
                
                <div className="rule-section">
                    <h3>Työnhakukeskustelu (3kk välein)</h3>
                    <p>Työnhakukeskustelu järjestetään aina, kun edellisestä tehostetusta jaksosta tai edellisestä vastaavasta 3kk keskustelusta on kulunut kolme kuukautta.</p>
                    <p><strong>Koskee:</strong> Kaikkia työttömiä, työttömyysuhan alaisia, osa-aikatyössä olevia ja lyhennetyllä työajalla lomautettuja.</p>
                </div>

                <div className="rule-section">
                    <h3>Täydentävät työnhakukeskustelut (6kk välein)</h3>
                    <p>Kaksi (2) täydentävää työnhakukeskustelua järjestetään kuukauden aikana aina, kun edellisestä tehostetusta jaksosta on kulunut kuusi kuukautta.</p>
                </div>

                <div className="rule-section">
                    <h3>Keskeiset poikkeukset</h3>
                    <p>Tehostettuja jaksoja ja 3kk keskusteluja ei pääsääntöisesti järjestetä, jos työnhakija on arviolta yli kuukauden kestävässä:</p>
                    <ul>
                        <li>Työvoimakoulutuksessa</li>
                        <li>Työkokeilussa</li>
                        <li>Palkkatuetussa työssä</li>
                        <li>Kuntoutuksessa</li>
                        <li>Omaehtoisessa opiskelussa (tietyin ehdoin)</li>
                    </ul>
                    <p>Keskusteluja ei myöskään järjestetä, jos tiedossa on yli 3kk kestävä poissaolo (esim. työ, perhevapaa, varusmiespalvelus), joka alkaa seuraavan 3kk aikana.</p>
                </div>
            </div>
        </div>
    );
};

export default RulesModal;
