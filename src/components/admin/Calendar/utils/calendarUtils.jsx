import React from 'react';
import { Phone, MapPin } from 'lucide-react';

export const getMonday = (d) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); 
    date.setDate(diff);
    date.setHours(0, 0, 0, 0);
    return date;
};

export const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

export const formatDateLocal = (date) => {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
};

export const parseDBDateLocal = (dbString) => {
    if (!dbString) return { datePart: '', timeStr: '', isWholeDay: false };
    if (dbString.includes('00:00:00')) {
        return { datePart: dbString.substring(0, 10), timeStr: '00:00', isWholeDay: true };
    }
    const d = new Date(dbString);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return { datePart: `${year}-${month}-${day}`, timeStr: `${hours}:${minutes}`, isWholeDay: false };
};

export const meetingTypes = [
    { id: 'normi', label: 'Normaali', color: 'var(--color-primary)', bg: 'rgba(255, 107, 0, 0.05)' },
    { id: 'aktivointi', label: 'Aktivointi', color: 'var(--color-success)', bg: 'rgba(30, 154, 90, 0.05)' },
    { id: 'taydentava', label: 'Täydentävä', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.05)' }
];

export const getMeetingStyle = (typeId, isBlocked = false) => {
    const typeConfig = meetingTypes.find(t => t.id === typeId) || meetingTypes[0];
    if (isBlocked && typeId === 'estetty') return { backgroundColor: '#fef2f2', border: '1px dashed #e34a4a', color: '#e34a4a' };
    if (isBlocked && typeId !== 'estetty') return { backgroundColor: 'var(--color-surface)', border: `1px dashed ${typeConfig.color}`, color: typeConfig.color, opacity: 0.65 };
    return { backgroundColor: typeConfig.bg, border: `1px dashed ${typeConfig.color}`, color: typeConfig.color };
};

export const getMeetingLabel = (typeId) => meetingTypes.find(t => t.id === typeId)?.label || typeId;
export const renderContactIcon = (method, size = 14) => method === 'puhelu' ? <Phone size={size} /> : <MapPin size={size} />;

export const timeToRow = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    if (h < 7) return 2; 
    if (h > 19 || (h === 19 && m > 0)) return 50; 
    return (h - 7) * 4 + (Math.round(m / 15)) + 2;
};

export const getGridPlacement = (dayIndex, startTime, endTime) => {
    const startRow = timeToRow(startTime);
    const endRow = endTime ? timeToRow(endTime) : startRow + 4; 
    return { gridColumn: dayIndex + 2, gridRow: `${startRow} / ${Math.min(50, endRow)}` };
};