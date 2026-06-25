/**
 * ExamResult.jsx — Exam Terminated screen
 * Shown when a tab-switch or window-focus-loss violation is detected.
 */

export default function ExamResult({ violation = 'Window Focus Lost', onBackHome }) {
    const timestamp = new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    });

    return (
        <div style={styles.overlay}>
            <div style={styles.card}>
                {/* Red shield icon */}
                <div style={styles.shieldCircle}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                            d="M12 2L3 7V12C3 17.55 6.84 22.74 12 24C17.16 22.74 21 17.55 21 12V7L12 2Z"
                            fill="rgba(220, 38, 38, 0.25)"
                            stroke="#dc2626"
                            strokeWidth="1.5"
                        />
                        <circle cx="12" cy="10" r="1.2" fill="#dc2626" />
                        <rect x="11.25" y="12.5" width="1.5" height="4" rx="0.75" fill="#dc2626" />
                    </svg>
                </div>

                {/* Heading */}
                <h1 style={styles.heading}>Exam Terminated</h1>

                {/* Explanation */}
                <p style={styles.description}>
                    Your session was automatically terminated due to a
                    <br />
                    security violation (Tab switch or focus loss detected).
                </p>

                {/* Incident report box */}
                <div style={styles.incidentBox}>
                    <div style={styles.incidentHeader}>
                        <span style={styles.incidentLabel}>INCIDENT REPORT</span>
                    </div>
                    <div style={styles.violationText}>Violation: {violation}</div>
                    <div style={styles.timestampText}>Timestamp: {timestamp}</div>
                </div>

                {/* Return button */}
                <button
                    style={styles.button}
                    onClick={onBackHome}
                    onMouseEnter={(e) => {
                        e.target.style.background = '#fff';
                        e.target.style.color = '#0a0b10';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.background = 'transparent';
                        e.target.style.color = '#fff';
                    }}
                >
                    Return to Home
                </button>
            </div>
        </div>
    );
}

const styles = {
    overlay: {
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0b10',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    },
    card: {
        background: 'linear-gradient(145deg, #16171f, #111219)',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.06)',
        padding: '48px 44px 40px',
        width: '100%',
        maxWidth: '480px',
        textAlign: 'center',
    },
    shieldCircle: {
        width: '72px',
        height: '72px',
        borderRadius: '50%',
        background: 'rgba(220, 38, 38, 0.1)',
        border: '2px solid rgba(220, 38, 38, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px',
    },
    heading: {
        fontSize: '1.6rem',
        fontWeight: 700,
        color: '#fff',
        margin: '0 0 12px',
        letterSpacing: '-0.01em',
    },
    description: {
        fontSize: '0.85rem',
        color: 'rgba(255,255,255,0.45)',
        lineHeight: 1.6,
        margin: '0 0 28px',
    },
    incidentBox: {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '10px',
        padding: '16px 20px',
        textAlign: 'left',
        marginBottom: '28px',
    },
    incidentHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
    },
    incidentLabel: {
        fontSize: '0.65rem',
        fontWeight: 700,
        color: 'rgba(255,255,255,0.3)',
        letterSpacing: '0.1em',
        fontFamily: "'JetBrains Mono', monospace",
    },
    incidentId: {
        fontSize: '0.65rem',
        color: 'rgba(255,255,255,0.25)',
        fontFamily: "'JetBrains Mono', monospace",
    },
    violationText: {
        fontSize: '0.85rem',
        color: '#ef4444',
        fontWeight: 600,
        fontFamily: "'JetBrains Mono', monospace",
        marginBottom: '4px',
    },
    timestampText: {
        fontSize: '0.75rem',
        color: 'rgba(255,255,255,0.3)',
        fontFamily: "'JetBrains Mono', monospace",
    },
    button: {
        width: '100%',
        padding: '15px',
        background: 'transparent',
        color: '#fff',
        border: '2px solid rgba(255,255,255,0.9)',
        borderRadius: '10px',
        fontSize: '0.85rem',
        fontWeight: 700,
        letterSpacing: '0.12em',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        fontFamily: 'inherit',
    },
};
