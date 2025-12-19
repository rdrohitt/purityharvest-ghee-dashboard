import { FormEvent, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { loginWithEmailPassword, isAuthenticated } from '../auth';

export default function Login() {
	const navigate = useNavigate();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Redirect if already authenticated (remembered credentials)
	useEffect(() => {
		if (isAuthenticated()) {
			navigate('/admin', { replace: true });
		}
	}, [navigate]);

	async function onSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);
		try {
			await loginWithEmailPassword(email, password);
			navigate('/admin');
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="auth-wrapper">
			<div className="auth-card">
				<div className="auth-icon">🔷</div>
				<h1 className="auth-title">Welcome Back</h1>
				<p className="auth-subtitle">Enter your credentials to access your account</p>
				<form onSubmit={onSubmit}>
					<div className="field">
						<label className="label" htmlFor="email">Email</label>
						<input
							id="email"
							className="input"
							type="email"
							placeholder="name@example.com"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							required
						/>
					</div>
					<div className="field">
						<label className="label" htmlFor="password">Password</label>
						<input
							id="password"
							className="input"
							type="password"
							placeholder="••••••••"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							autoComplete="current-password"
							required
						/>
					</div>
					{error ? <div style={{ color: '#b91c1c', marginTop: 8 }}>{error}</div> : null}
					<div style={{ marginTop: 16 }}>
						<button className="button" type="submit" disabled={loading}>
							{loading ? 'Signing in…' : 'Sign In'}
						</button>
					</div>
				</form>
				<p className="muted">
					Don't have an account? <Link className="link" to="#">Sign up</Link>
				</p>
			</div>
		</div>
	);
}


