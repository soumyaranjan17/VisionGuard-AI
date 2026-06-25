import './WarningPanel.css';

/**
 * Panel displaying real-time proctoring metrics, gaze gauge,
 * and a scrollable Activity Log (replaces the old flag checkboxes).
 */
export default function WarningPanel({ activeFlags, workerStatus, gazeRatio, faceCount, flagLog = [] }) {
    const activeCount = activeFlags.size;

    return (
        <div className="warning-panel">
            {/* ── Header ──────────────────────────────────────── */}
            <div className="panel-header">
                <div className="panel-title-row">
                    <h2 className="panel-title">
                        <span className="title-icon">🛡️</span>
                        Proctor Shield
                    </h2>
                    <div className={`status-badge ${activeCount > 0 ? 'status-alert' : 'status-clear'}`}>
                        {activeCount > 0 ? `${activeCount} Alert${activeCount > 1 ? 's' : ''}` : 'All Clear'}
                    </div>
                </div>
                <p className="panel-subtitle">Real-time integrity monitoring</p>
            </div>

            {/* ── Metrics Bar ─────────────────────────────────── */}
            <div className="metrics-bar">
                <div className="metric">
                    <span className="metric-label">Faces</span>
                    <span className={`metric-value ${faceCount === 1 ? 'metric-ok' : 'metric-warn'}`}>
                        {faceCount === -1 ? '—' : faceCount}
                    </span>
                </div>
                <div className="metric-divider" />
                <div className="metric">
                    <span className="metric-label">Gaze</span>
                    <span className="metric-value">{(gazeRatio * 100).toFixed(0)}%</span>
                </div>
                <div className="metric-divider" />
                <div className="metric">
                    <span className="metric-label">Engine</span>
                    <span className={`metric-value ${workerStatus.includes('ready') ? 'metric-ok' : 'metric-loading'}`}>
                        {workerStatus.includes('ready') ? 'Live' : 'Loading'}
                    </span>
                </div>
            </div>

            {/* ── Gaze Gauge ──────────────────────────────────── */}
            <div className="gaze-gauge">
                <div className="gaze-label-row">
                    <span className="gaze-dir">← Left</span>
                    <span className="gaze-center">Center</span>
                    <span className="gaze-dir">Right →</span>
                </div>
                <div className="gaze-track">
                    <div className="gaze-zone gaze-danger-left" />
                    <div className="gaze-zone gaze-safe" />
                    <div className="gaze-zone gaze-danger-right" />
                    <div
                        className="gaze-needle"
                        style={{ left: `${Math.min(Math.max(gazeRatio * 100, 2), 98)}%` }}
                    />
                </div>
            </div>

            {/* ── Activity Log (moved from bottom panel) ──────── */}
            <div className="sidebar-log">
                <h3 className="sidebar-log-title">
                    <span className="log-title-icon">▸</span>
                    Activity Log
                </h3>
                <div className="sidebar-log-entries">
                    {flagLog.length === 0 ? (
                        <div className="sidebar-log-empty">No events recorded yet</div>
                    ) : (
                        flagLog.slice(0, 30).map((entry, i) => (
                            <div key={`${entry.timestamp}-${i}`} className="sidebar-log-entry">
                                <span className="sidebar-log-time">
                                    {new Date(entry.timestamp).toLocaleTimeString()}
                                </span>
                                <span className="sidebar-log-msg">{entry.message}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* ── Engine Status ───────────────────────────────── */}
            <div className="engine-status">
                <div className="engine-dot" />
                <span className="engine-text">{workerStatus}</span>
            </div>
        </div>
    );
}
