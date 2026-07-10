import React, { useState } from 'react';
import { Lock, User, Clock, ShieldCheck } from 'lucide-react';
import SmartInput from './common/SmartInput';
import Button from './common/Button';
import AlertBox from './common/AlertBox';
import Card from './common/Card';

const LoginScreen = ({ onLogin, isLoggingIn }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [duration, setDuration] = useState('0'); // 0 = session-only
    const [error, setError] = useState(false);
    const [isShake, setIsShake] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(false);
        
        const success = await onLogin(email, password, parseInt(duration, 10));
        
        if (!success) {
            setError(true);
            setIsShake(true);
            setTimeout(() => setIsShake(false), 500); // Resetoi tärinä
        }
    };

    const shakeStyle = isShake ? { transform: 'translateX(-5px)', transition: 'transform 0.1s' } : {};

    return (
        <div className="modal-overlay" style={{ backdropFilter: 'blur(10px)', backgroundColor: 'rgba(10, 23, 36, 0.7)' }}>
            <div style={{ maxWidth: '400px', width: '90%', margin: '0 auto', ...shakeStyle }}>
                <Card variant="default" className="text-center">
                    
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

                    <h2 className="text-xl fw-bold mb-2">Kirjaudu sisään</h2>
                    <p className="text-sm text-secondary mb-4">
                        Espan-työllisyyssuunnitelmatyökalu
                    </p>

                    <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
                        <div style={{ marginBottom: '1rem' }}>
                            <SmartInput 
                                label="Sähköposti" 
                                icon={<User size={16} />} 
                                type="email"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); setError(false); }}
                                placeholder="asiantuntija@organisaatio.fi"
                            />
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <SmartInput 
                                label="Salasana" 
                                icon={<Lock size={16} />} 
                                type="password"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(false); }}
                                placeholder="Syötä salasana..."
                                mono={true}
                            />
                        </div>

                        <div style={{ marginBottom: '2rem' }}>
                            <label className="text-sm fw-semibold mb-2" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Clock size={16} /> Istunnon kesto
                            </label>
                            <div className="select-wrapper">
                                <select 
                                    className="modern-select" 
                                    value={duration} 
                                    onChange={(e) => setDuration(e.target.value)}
                                >
                                    <option value="0">Vain tämä selausistunto (Turvallisin)</option>
                                    <option value="3600000">1 tunti</option>
                                    <option value="21600000">6 tuntia</option>
                                    <option value="86400000">24 tuntia</option>
                                </select>
                            </div>
                        </div>

                        {error && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <AlertBox type="danger">
                                    Virheellinen sähköposti tai salasana, tai sinulla ei ole käyttöoikeutta.
                                </AlertBox>
                            </div>
                        )}

                        <Button 
                            type="submit" 
                            variant="primary" 
                            className="w-100" 
                            style={{ justifyContent: 'center' }}
                            disabled={isLoggingIn}
                        >
                            {isLoggingIn ? 'Tunnistaudutaan...' : 'Avaa työkalu'}
                        </Button>
                    </form>

                    <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}>
                        <ShieldCheck size={14} className="text-success" /> 
                        <span className="text-xs text-secondary">NSG Central -suojattu yhteys</span>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default LoginScreen;