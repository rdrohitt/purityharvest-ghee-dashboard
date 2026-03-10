import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Spinner } from '../../components/Spinner';
import { loginWithUsernamePassword, isAuthenticated } from '../../auth';

export default function Login() {
	const navigate = useNavigate();
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (isAuthenticated()) {
		return <Navigate to="/admin" replace />;
	}

	async function onSubmit(e: FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);
		try {
			await loginWithUsernamePassword(username, password);
			navigate('/admin');
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="auth-wrapper">
			{loading && (
				<Spinner overlay fixed message="Signing in…" />
			)}
			<div className="auth-card">
				<div className="auth-icon">🔷</div>
				<h1 className="auth-title">Welcome Back</h1>
				<p className="auth-subtitle">Enter your credentials to access your account</p>
				<form onSubmit={onSubmit}>
					<div className="field">
						<label className="label" htmlFor="username">Username</label>
						<input
							id="username"
							className="input"
							type="text"
							placeholder="Username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							autoComplete="username"
							required
							disabled={loading}
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
							disabled={loading}
						/>
					</div>
					{error ? <div style={{ color: '#b91c1c', marginTop: 8 }}>{error}</div> : null}
					<div style={{ marginTop: 16 }}>
						<button className="button" type="submit" disabled={loading}>
							{loading ? (
								<span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
									<Spinner size="sm" />
									Signing in…
								</span>
							) : (
								'Sign In'
							)}
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


