# useAuth() Hook - Quick Reference

## Import

```typescript
import { useAuth } from "@/contexts/AuthContext";
```

## Usage

```typescript
function MyComponent() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  
  // ... use auth state and methods
}
```

## API

### `user`
- **Type**: `FirebaseUser | null`
- **Description**: Current authenticated user or null if not logged in
- **Properties**:
  - `user.uid` - Unique user ID
  - `user.email` - User email
  - `user.displayName` - User display name
  - `user.photoURL` - User profile photo URL

### `loading`
- **Type**: `boolean`
- **Description**: True while checking authentication state
- **Use**: Show loading spinner while auth initializes

### `signInWithGoogle()`
- **Type**: `() => Promise<void>`
- **Description**: Opens Google sign-in popup
- **Behavior**: Automatically redirects to `/select-account` on success
- **Throws**: Error if sign-in fails

### `signOut()`
- **Type**: `() => Promise<void>`
- **Description**: Signs out current user
- **Behavior**: Automatically redirects to `/` on success
- **Throws**: Error if sign-out fails

## Examples

### Check if User is Logged In

```typescript
function Header() {
  const { user } = useAuth();
  
  return (
    <div>
      {user ? (
        <p>Welcome, {user.displayName}!</p>
      ) : (
        <p>Please log in</p>
      )}
    </div>
  );
}
```

### Show Loading State

```typescript
function ProtectedPage() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!user) {
    return <div>Access denied</div>;
  }
  
  return <div>Protected content</div>;
}
```

### Sign In Button

```typescript
function LoginButton() {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  
  const handleLogin = async () => {
    try {
      await signInWithGoogle();
      // User will be redirected automatically
    } catch (err: any) {
      setError(err.message);
    }
  };
  
  return (
    <div>
      <button onClick={handleLogin}>
        Sign in with Google
      </button>
      {error && <p>{error}</p>}
    </div>
  );
}
```

### Sign Out Button

```typescript
function LogoutButton() {
  const { signOut } = useAuth();
  
  const handleLogout = async () => {
    try {
      await signOut();
      // User will be redirected to / automatically
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };
  
  return (
    <button onClick={handleLogout}>
      Logout
    </button>
  );
}
```

### Display User Info

```typescript
function UserProfile() {
  const { user } = useAuth();
  
  if (!user) return null;
  
  return (
    <div>
      <img src={user.photoURL || "/default-avatar.png"} alt="Avatar" />
      <h2>{user.displayName || "Anonymous"}</h2>
      <p>{user.email}</p>
    </div>
  );
}
```

### Conditional Rendering

```typescript
function Navigation() {
  const { user } = useAuth();
  
  return (
    <nav>
      <Link href="/">Home</Link>
      {user ? (
        <>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/select-account">Accounts</Link>
        </>
      ) : (
        <Link href="/">Login</Link>
      )}
    </nav>
  );
}
```

## Error Handling

```typescript
function LoginPage() {
  const { signInWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const handleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (err: any) {
      // Handle specific error codes
      if (err.code === "auth/popup-closed-by-user") {
        setError("Sign-in cancelled");
      } else if (err.code === "auth/popup-blocked") {
        setError("Popup blocked. Please allow popups.");
      } else {
        setError(err.message || "Failed to sign in");
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <button onClick={handleLogin} disabled={loading}>
        {loading ? "Signing in..." : "Sign in with Google"}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
```

## TypeScript Types

```typescript
import { User as FirebaseUser } from "firebase/auth";

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}
```

## Notes

- ✅ `useAuth()` must be used within `<AuthProvider>`
- ✅ Auth state persists across page refreshes
- ✅ Automatic redirects after login/logout
- ✅ Session cookies are httpOnly for security
- ⚠️ Throws error if used outside AuthProvider

## Common Patterns

### Protected Component

```typescript
function ProtectedComponent() {
  const { user, loading } = useAuth();
  
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/" />;
  
  return <div>Protected content for {user.email}</div>;
}
```

### Auth-aware Layout

```typescript
function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  
  return (
    <div>
      <Header user={user} />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
```
