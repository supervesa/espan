import React from 'react';

const RulesModal = ({ onClose }) => {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-button" onClick={onClose}>&times;</button>
                <h2>Työnhakukeskustelujen Säännöt</h2>
                
                <div className="rule-section">
                    <h3>Työnhakukeskustelu (3kk välein)</h3>
                    <p>Työvoimaviranomainen järjestää työttömälle ja työttömyysuhan alaiselle työnhakijalle työnhakukeskustelun aina, kun alkuhaastattelusta tai edellisestä vastaavasta keskustelusta on kulunut kolme kuukautta.</p>
                    <p><strong>Koskee:</strong> Kaikkia työttömiä, työttömyysuhan alaisia, osa-aikatyössä olevia ja lyhennetyllä työajalla lomautettuja.</p>
                </div>

                <div className="rule-section">
                    <h3>Täydentävät työnhakukeskustelut (6kk välein)</h3>
                    <p>Kaksi täydentävää työnhakukeskustelua järjestetään, kun alkuhaastattelusta tai edellisestä vastaavasta 6kk jaksosta on kulunut kuusi kuukautta.</p>
                     <p><strong>Koskee vain niitä työttömiä, jotka eivät osallistu työllistymistä tukeviin palveluihin.</strong></p>
                </div>

                <div className="rule-section">
                    <h3>Poikkeukset keskustelujen järjestämiseen</h3>
                    <p>Keskusteluja ei pääsääntöisesti järjestetä työnhakijalle, jonka:</p>
                    <ul>
                        <li>Työttömyys on päättymässä kolmen kuukauden kuluessa (kesto väh. 3kk).</li>
                        <li>On aloittamassa kolmen kuukauden kuluessa varusmies- tai siviilipalveluksen tai perhevapaan (kesto väh. 3kk).</li>
                    </ul>
                    <p>Keskustelut on kuitenkin aina järjestettävä työnhakijan pyynnöstä.</p>
                </div>
            </div>
        </div>
    );
};

export default RulesModal;
