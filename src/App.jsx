import { useEffect, useState, useCallback, lazy, Suspense } from 'react';

import { registerUser } from "./services/registerUser.js";
import { ToastViewport, toast } from "./reusecomponent/toast.jsx";
import ServerDownPage from "./components/ServerDownPage.jsx";
import {
  checkServerHealth,
  getServerStatusSnapshot,
  subscribeToServerStatus
} from "./services/apiClient.js";

// Lazy load components
const LandingPage = lazy(() => import("./components/landingpage.jsx").then(module => ({ default: module.LandingPage })));
const Login =lazy(() => import("./components/Login.jsx").then(module => ({ default: module.Login })));
const Dashboard = lazy(() => import("./components/Dashboard.jsx"));
const RegistrationForm = lazy(() => import("./components/Registration.jsx").then(module => ({ default: module.RegistrationForm })));
const PetOwnerProfileForm = lazy(() => import("./components/petownerprofileRegistration.jsx").then(module => ({ default: module.PetOwnerProfileForm })));
const EmailVerification = lazy(() => import("./components/EmailVerification.jsx").then(module => ({ default: module.EmailVerification })));
const ForgotPassword = lazy(() => import("./components/ForgotPassword.jsx").then(module => ({ default: module.ForgotPassword })));
const TVStatusDisplay = lazy(() => import("./components/StatusDisplay/TVStatusDisplay.jsx"));

const routes = {
  landing: '/landing',
  login: '/landing/login',
  dashboard: '/dashboard',
  register: '/landing/register',
  registerProfile: '/landing/register/profile',
  verifyEmail: '/landing/verify-email',
  forgotPassword: '/landing/forgot-password',
  statusDisplay: '/status-display',
};

function isStatusDisplayHost(hostname = '') {
  const normalizedHost = String(hostname || '').toLowerCase();
  return normalizedHost === 'status.ipawcus.com' || normalizedHost.startsWith('status.');
}

function getViewFromPath(pathname) {
  if (pathname === routes.statusDisplay || pathname.startsWith(`${routes.statusDisplay}/`)) {
    return 'statusDisplay';
  }

  if (pathname === '/' && isStatusDisplayHost(window.location.hostname)) {
    return 'statusDisplay';
  }

  if (pathname.startsWith('/dashboard')) {
    return 'dashboard';
  }

  switch (pathname) {
    case '/':
      return 'landing';
    case routes.login:
      return 'login';
    case routes.register:
      return 'register';
    case routes.registerProfile:
      return 'registerProfile';
    case routes.verifyEmail:
      return 'verifyEmail';
    case routes.forgotPassword:
      return 'forgotPassword';
    case routes.landing:
    default:
      return 'landing';
  }
}

function getRouteRedirect(viewName, storedUser, registrationEmail = '') {
  if (viewName === 'statusDisplay') {
    return { view: viewName, path: null };
  }

  if (storedUser && ['landing', 'login', 'register', 'registerProfile', 'verifyEmail', 'forgotPassword'].includes(viewName)) {
    return { view: 'dashboard', path: routes.dashboard };
  }

  if (!storedUser && viewName === 'dashboard') {
    return { view: 'login', path: routes.login };
  }

  if (viewName === 'registerProfile' && !registrationEmail) {
    return { view: 'register', path: routes.register };
  }

  return { view: viewName, path: null };
}

const initialRegistrationData = {
  email: '',
  password: '',
  confirmPassword: '',
  role: 'pet_owner',
  FirstName:'',
  LastName:'',
  address: '',
  phoneNumber: '',
  emergencyNumber: '',
};

function App() {
  const [view, setView] = useState(() => {
    const storedUser = localStorage.getItem('currentUser');
    return getRouteRedirect(getViewFromPath(window.location.pathname), storedUser).view;
  });
  const [currentUser, setCurrentUser] = useState(() => {
    const storedUser = localStorage.getItem('currentUser');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [registrationData, setRegistrationData] = useState(initialRegistrationData);
  const [registrationFlowKey, setRegistrationFlowKey] = useState(0);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState(() => (
    localStorage.getItem('pendingVerificationEmail') || ''
  ));
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [serverStatus, setServerStatus] = useState(() => getServerStatusSnapshot());
  const [isCheckingServer, setIsCheckingServer] = useState(false);

  useEffect(() => {
    const handlePopState = () => {
      const nextView = getViewFromPath(window.location.pathname);
      const storedUser = localStorage.getItem('currentUser');

      if (nextView === 'statusDisplay') {
        setCurrentUser(storedUser ? JSON.parse(storedUser) : null);
        setView(nextView);
        return;
      }

      if (nextView === 'dashboard' && !storedUser) {
        window.history.replaceState({}, '', routes.login);
        setView('login');
        return;
      }
      
      if (['login', 'landing', 'register', 'registerProfile', 'verifyEmail', 'forgotPassword'].includes(nextView) && storedUser) {
        window.history.replaceState({}, '', routes.dashboard);
        setView('dashboard');
        setCurrentUser(JSON.parse(storedUser));
        return;
      }

      setCurrentUser(storedUser ? JSON.parse(storedUser) : null);
      setView(nextView);
    };

    window.addEventListener('popstate', handlePopState);

    // Initial check for authenticated user on public routes
    const storedUser = localStorage.getItem('currentUser');
    const currentView = getViewFromPath(window.location.pathname);
    const redirect = getRouteRedirect(currentView, storedUser);
    
    if (redirect.path) {
      window.history.replaceState({}, '', redirect.path);
    }

    if (window.location.pathname === '/' && !storedUser && currentView !== 'statusDisplay') {
      window.history.replaceState({}, '', routes.landing);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    return subscribeToServerStatus(setServerStatus);
  }, []);

  const retryServerConnection = useCallback(async (options = {}) => {
    const showChecking = options?.showChecking !== false;

    if (showChecking) {
      setIsCheckingServer(true);
    }

    try {
      await checkServerHealth();
    } catch (error) {
      console.error('Server health check failed:', error);
    } finally {
      if (showChecking) {
        setIsCheckingServer(false);
      }
    }
  }, []);

  useEffect(() => {
    retryServerConnection({ showChecking: false });
  }, [retryServerConnection]);

  useEffect(() => {
    if (!serverStatus.isDown) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      retryServerConnection({ showChecking: false });
    }, 15000);

    return () => window.clearInterval(timerId);
  }, [retryServerConnection, serverStatus.isDown]);

  useEffect(() => {
    if (view === 'dashboard' && !currentUser) {
      window.history.replaceState({}, '', routes.login);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [currentUser, view]);

  useEffect(() => {
    if (view === 'registerProfile' && !registrationData.email) {
      window.history.replaceState({}, '', routes.register);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [view, registrationData.email]);

  const resetRegistrationFlow = useCallback(() => {
    setRegistrationData(initialRegistrationData);
    setRegistrationFlowKey((currentValue) => currentValue + 1);
  }, []);

  const navigateTo = useCallback((path, options = {}) => {
    const shouldResetRegistration = path === routes.register && !options.preserveRegistration;

    if (shouldResetRegistration) {
      resetRegistrationFlow();
    }

    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }

    setView(getViewFromPath(path));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [resetRegistrationFlow]);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    navigateTo(routes.dashboard);
  };

  const handleUserUpdate = useCallback((updatedUser) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('currentUser', JSON.stringify(updatedUser));
    
    // Also update in the 'users' list if it exists
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const index = users.findIndex(u => (u.id === updatedUser.id || u.user_id === updatedUser.id));
    if (index !== -1) {
      users[index] = { ...users[index], ...updatedUser };
      localStorage.setItem('users', JSON.stringify(users));
    }
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
    navigateTo(routes.login);
  }, [navigateTo]);

  const handleRegistrationContinue = (accountData) => {
    setRegistrationData(accountData);
    navigateTo(routes.registerProfile);
  };

  const handleRegistrationComplete = async (profileData) => {
    const completedRegistration = {
      ...registrationData,
      ...profileData,
    };

    try {
      const result = await registerUser(completedRegistration);
      const verificationEmail = result.email || completedRegistration.email;
      localStorage.setItem('pendingVerificationEmail', verificationEmail);
      setPendingVerificationEmail(verificationEmail);
      toast.success(result.emailSent === false
        ? result.message || 'Registration completed. Request a new verification code.'
        : 'Registration completed. Verification code sent.');
      resetRegistrationFlow();
      navigateTo(routes.verifyEmail);
    } catch (error) {
      console.error('Registration failed:', error);
      setRegistrationData((currentData) => ({
        ...currentData,
        password: '',
        confirmPassword: '',
      }));
      setRegistrationFlowKey((currentValue) => currentValue + 1);
      toast.error(error.message || 'Registration failed.');
      navigateTo(routes.register, { preserveRegistration: true });
    }
  };

  const handleVerifyEmailRoute = (email = '') => {
    const nextEmail = email || pendingVerificationEmail || '';
    if (nextEmail) {
      localStorage.setItem('pendingVerificationEmail', nextEmail);
      setPendingVerificationEmail(nextEmail);
    }
    navigateTo(routes.verifyEmail);
  };

  const handleVerificationComplete = () => {
    localStorage.removeItem('pendingVerificationEmail');
    setPendingVerificationEmail('');
    navigateTo(routes.login);
  };

  const handleForgotPasswordRoute = (email = '') => {
    setForgotPasswordEmail(email);
    navigateTo(routes.forgotPassword);
  };

  if (serverStatus.isDown) {
    return (
      <ServerDownPage
        isRetrying={isCheckingServer}
        onRetry={retryServerConnection}
      />
    );
  }

  const activeView = getRouteRedirect(view, currentUser, registrationData.email).view;

  return (
    <Suspense fallback={
      <div className="flex h-screen w-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#155dfc] border-t-transparent"></div>
          <p className="text-lg font-medium text-slate-600">Loading iPawcus...</p>
        </div>
      </div>
    }>
      <div className={activeView === 'dashboard' ? 'min-h-screen theme-aware' : 'min-h-screen theme-static-light'}>
        <ToastViewport />
        {activeView === 'statusDisplay' && (
          <TVStatusDisplay />
        )}

        {activeView === 'landing' && (
            <LandingPage
                onLogin={() => navigateTo(routes.login)}
                onRegister={() => navigateTo(routes.register)}
            />
        )}

        {activeView === 'login' && (
            <Login
                onLogin={handleLoginSuccess}
                onBack={() => navigateTo(routes.landing)}
                onRegister={() => navigateTo(routes.register)}
                onForgotPassword={() => handleForgotPasswordRoute()}
                onVerifyEmail={handleVerifyEmailRoute}
            />
        )}

        {activeView === 'verifyEmail' && (
            <EmailVerification
                initialEmail={pendingVerificationEmail}
                onBack={() => navigateTo(routes.login)}
                onVerified={handleVerificationComplete}
            />
        )}

        {activeView === 'forgotPassword' && (
            <ForgotPassword
                initialEmail={forgotPasswordEmail}
                onBack={() => navigateTo(routes.login)}
                onComplete={() => navigateTo(routes.login)}
            />
        )}

        {activeView === 'dashboard' && currentUser && (
            <Dashboard user={currentUser} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
        )}

        {activeView === 'register' && (
            <RegistrationForm
                key={`register-${registrationFlowKey}`}
                onBackHome={() => navigateTo(routes.landing)}
                onLogin={() => navigateTo(routes.login)}
                initialValues={registrationData}
                onContinue={handleRegistrationContinue}
            />
        )}

        {activeView === 'registerProfile' && (
            <PetOwnerProfileForm
                key={`register-profile-${registrationFlowKey}`}
                email={registrationData.email}
                onBack={() => navigateTo(routes.register, { preserveRegistration: true })}
                onComplete={handleRegistrationComplete}
            />
        )}
      </div>
    </Suspense>
  );
}

export default App;
