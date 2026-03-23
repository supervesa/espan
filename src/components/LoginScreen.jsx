import React, { useState } from 'react';
import { Lock, Unlock, Clock, AlertCircle, ShieldCheck } from 'lucide-react';

const LoginScreen = ({ onLogin }) => {
    const [password, setPassword] = useState('');
    const [duration, setDuration] = useState('0'); // 0 = Ei tallennusta
    const [error, setError] = useState(false);
    const [isShake, setIsShake] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        const success = onLogin(password, parseInt(duration, 10));
        
        if (!success) {
            setError(true);
            setIsShake(true);
            setTimeout(() => setIsShake(false), 500); // Resetoi animaatio
        }
    };

    // Yksinkertainen tärinä-animaatio virhetilanteessa
    const shakeStyle = isShake ? { transform: 'translateX(-5px)', transition: 'transform 0.1s' } : {};

    return (
        <div className="modal-overlay" style={{ backdropFilter: 'blur(10px)', backgroundColor: 'rgba(10, 23, 36, 0.7)' }}>
            <div className="modal-content" style={{ maxWidth: '400px', width: '90%', textAlign: 'center', ...shakeStyle }}>
                
                <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                    <div style={{ 
                        background: 'rgba(255, 107, 0, 0.1)', 
                        padding: '1rem', 
                        borderRadius: '50%', 
                        display: 'inline-flex'
                    }}>
                        <Lock size={48} color="var(--color-primary)" />
                    </div>
                </div>

                <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Kirjaudu sisään</h2>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
                    Tämä työkalu on suojattu salasanalla.
                </p>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
                        <label style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>
                            Pääsykoodi
                        </label>
                        <input 
                            type="password" 
                            className="form-input" 
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(false); }}
                            placeholder="Syötä salasana..."
                            autoFocus
                            style={{ padding: '0.75rem', fontSize: '1rem' }}
                        />
                    </div>

                    <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
                        <label style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Clock size={16} /> Istunnon kesto
                        </label>
                        <div className="select-wrapper" style={{ position: 'relative' }}>
                            <select 
                                className="modern-select" // Käyttää espan2.css tyyliä
                                value={duration} 
                                onChange={(e) => setDuration(e.target.value)}
                            >
                                <option value="0">Ei tallennusta (Vain tämä kerta)</option>
                                <option value="3600000">1 tunti</option>
                                <option value="21600000">6 tuntia</option>
                                <option value="86400000">24 tuntia</option>
                                <option value="259200000">72 tuntia</option>
                            </select>
                        </div>
                    </div>

                    {error && (
                        <div style={{ 
                            marginBottom: '1.5rem', 
                            padding: '0.75rem', 
                            backgroundColor: 'rgba(227, 74, 74, 0.1)', 
                            border: '1px solid var(--color-danger)', 
                            borderRadius: '6px',
                            color: 'var(--color-danger)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.9rem'
                        }}>
                            <AlertCircle size={18} /> Virheellinen salasana. Yritä uudelleen.
                        </div>
                    )}

                    <button type="submit" className="btn" style={{ width: '100%', justifyContent: 'center', gap: '0.5rem', display: 'flex', alignItems: 'center' }}>
                        <Unlock size={18} /> Avaa työkalu
                    </button>
                </form>

                <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}>
                    <ShieldCheck size={14} /> Suojattu yhteys
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;