import { RiMoonClearLine, RiSunLine } from 'react-icons/ri';
import { useTheme } from '../context/ThemeContext';

export function ThemeToggle({ compact = false }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label={isDark ? 'Switch to day mode' : 'Switch to night mode'}
      onClick={toggleTheme}
      className={`theme-toggle ${compact ? 'theme-toggle-compact' : ''}`.trim()}
      title={isDark ? 'Day mode' : 'Night mode'}
    >
      <span className="theme-toggle-icon">{isDark ? <RiSunLine /> : <RiMoonClearLine />}</span>
      {!compact && <span className="theme-toggle-label">{isDark ? 'Day' : 'Night'}</span>}
    </button>
  );
}

export function FloatingThemeToggle() {
  return (
    <div className="theme-fab-wrap">
      <ThemeToggle compact />
    </div>
  );
}
