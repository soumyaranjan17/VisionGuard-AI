import { SEVERITY } from '../utils/constants';
import './StatusIndicator.css';

/**
 * Individual status badge/indicator for a detection metric.
 */
export default function StatusIndicator({ label, icon, description, severity, active, timestamp }) {
    const severityClass = active ? `severity-${severity}` : 'severity-ok';

    return (
        <div className={`status-indicator ${severityClass} ${active ? 'active' : 'inactive'}`}>
            <div className="indicator-header">
                <span className="indicator-icon">{active ? icon : '✅'}</span>
                <span className="indicator-label">{label}</span>
                {active && <span className="pulse-dot" />}
            </div>
            {active && (
                <p className="indicator-description">{description}</p>
            )}
            {active && timestamp && (
                <span className="indicator-time">
                    {new Date(timestamp).toLocaleTimeString()}
                </span>
            )}
        </div>
    );
}
