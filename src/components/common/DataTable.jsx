// --- src/components/common/DataTable.jsx ---
import React from 'react';

/**
 * columns: Array of objects { key: 'signal_key', label: 'Tunniste', render: (row) => JSX }
 * data: Array of data objects
 * keyField: Datan uniikki kenttä (esim. 'id' tai 'signal_key'), jota käytetään Reactin avaimena
 */
const DataTable = ({ columns, data, keyField = 'id', onRowClick, emptyMessage = 'Ei näytettävää dataa' }) => {
    
    return (
        <div style={{ overflowX: 'auto', width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                        {columns.map((col, index) => (
                            <th 
                                key={index} 
                                className="text-sm fw-semibold text-secondary"
                                style={{ padding: '0.75rem 1rem' }}
                            >
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className="text-center text-secondary text-sm font-italic" style={{ padding: '2rem' }}>
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        data.map((row) => (
                            <tr 
                                key={row[keyField]} 
                                onClick={() => onRowClick && onRowClick(row)}
                                style={{ 
                                    borderBottom: '1px solid var(--color-border)',
                                    cursor: onRowClick ? 'pointer' : 'default',
                                    transition: 'background-color 0.15s'
                                }}
                                onMouseOver={(e) => onRowClick && (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)')}
                                onMouseOut={(e) => onRowClick && (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                                {columns.map((col, colIndex) => (
                                    <td 
                                        key={colIndex} 
                                        className="text-sm"
                                        style={{ padding: '0.75rem 1rem', verticalAlign: 'middle' }}
                                    >
                                        {col.render ? col.render(row) : row[col.key]}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default DataTable;