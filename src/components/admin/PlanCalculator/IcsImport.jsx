// --- src/components/admin/PlanCalculator/IcsImport.jsx ---
import React, { useState } from 'react';
import ExpertImport from './IcsImport/ExpertImport';
import RoomImport from './IcsImport/RoomImport';
import Button from '../../common/Button';
import { Calendar, DoorOpen } from 'lucide-react';

const IcsImport = ({ asiantuntijaId, onImportComplete }) => {
    const [activeMode, setActiveMode] = useState('expert');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Välilehdet */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem' }}>
                <Button 
                    variant={activeMode === 'expert' ? 'primary' : 'secondary'} 
                    onClick={() => setActiveMode('expert')}
                    icon={Calendar}
                >
                    Asiantuntijan työtehtävät
                </Button>
                <Button 
                    variant={activeMode === 'room' ? 'primary' : 'secondary'} 
                    onClick={() => setActiveMode('room')}
                    icon={DoorOpen}
                >
                    Huone- ja tilavaraukset
                </Button>
            </div>

            {/* Renderöidään valittu työkalu */}
            {activeMode === 'expert' ? (
                <ExpertImport asiantuntijaId={asiantuntijaId} onImportComplete={onImportComplete} />
            ) : (
                <RoomImport asiantuntijaId={asiantuntijaId} onImportComplete={onImportComplete} />
            )}
        </div>
    );
};

export default IcsImport;