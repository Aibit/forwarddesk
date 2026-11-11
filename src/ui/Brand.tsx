// ForwardDesk brand (logo variant A: offset container stack + amber forward arrow).
// Light and dark files are both rendered; CSS shows the one matching :root[data-theme].
import markLight from '../assets/brand/logo-mark.svg';
import markDark from '../assets/brand/logo-mark-dark.svg';
import lockLight from '../assets/brand/logo-horizontal.svg';
import lockDark from '../assets/brand/logo-horizontal-dark.svg';
import './brand.css';

export function LogoMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`fd-logo-mark ${className}`} style={{ width: size, height: size }} data-testid="logo-mark">
      <img src={markLight} alt="ForwardDesk" className="fd-logo-l" width={size} height={size} />
      <img src={markDark} alt="" aria-hidden="true" className="fd-logo-d" width={size} height={size} />
    </span>
  );
}

/** Mark + "ForwardDesk" wordmark. The wordmark is Latin, so the lockup stays LTR in Farsi too. */
export function LogoLockup({ height = 36, className = '' }: { height?: number; className?: string }) {
  const w = Math.round((height * 485.9) / 128);
  return (
    <span className={`fd-logo-lock ${className}`} dir="ltr" style={{ height, width: w }} data-testid="logo-lockup">
      <img src={lockLight} alt="ForwardDesk" className="fd-logo-l" width={w} height={height} />
      <img src={lockDark} alt="" aria-hidden="true" className="fd-logo-d" width={w} height={height} />
    </span>
  );
}
