import './Spinner.css';

export type SpinnerSize = 'sm' | 'md' | 'lg';

type SpinnerProps = {
	/** Size of the spinner circle */
	size?: SpinnerSize;
	/** Show as overlay (centered, dimmed backdrop). Use for full-page or section loading. */
	overlay?: boolean;
	/** When overlay is true, use position: fixed to cover the whole viewport (e.g. during login). */
	fixed?: boolean;
	/** Optional message below the spinner (only used when overlay is true) */
	message?: string;
	/** Optional className for the wrapper (useful when overlay is true) */
	className?: string;
};

const sizeMap: Record<SpinnerSize, string> = {
	sm: 'var(--spinner-size-sm, 20px)',
	md: 'var(--spinner-size-md, 32px)',
	lg: 'var(--spinner-size-lg, 48px)',
};

export default function Spinner({ size = 'md', overlay = false, fixed = false, message, className = '' }: SpinnerProps) {
	const spinner = (
		<div className={`spinner__ring-wrapper`} style={{ width: sizeMap[size], height: sizeMap[size] }}>
			<div className="spinner__ring" aria-hidden="true" />
		</div>
	);

	if (overlay) {
		return (
			<div
				className={`spinner-overlay ${fixed ? 'spinner-overlay--fixed' : ''} ${className}`.trim()}
				role="status"
				aria-live="polite"
				aria-label={message || 'Loading'}
			>
				<div className="spinner-overlay__backdrop" />
				<div className="spinner-overlay__content">
					{spinner}
					{message ? <p className="spinner-overlay__message">{message}</p> : null}
				</div>
			</div>
		);
	}

	return (
		<span className={`spinner-inline ${className}`.trim()} role="status" aria-label="Loading">
			{spinner}
		</span>
	);
}
