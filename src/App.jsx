import { useEffect, useState, useCallback, lazy, Suspense } from 'react';

import { registerUser } from "./services/registerUser.js";
import { ToastViewport, toast } from "./reusecomponent/toast.jsx";
import ServerDownPage from "./components/ServerDownPage.jsx";
import {
  AUTH_EXPIRES_AT_KEY,
  checkServerHealth,
  clearStoredAuthSession,
  expireStoredAuthSession,
  getServerStatusSnapshot,
  isStoredAuthTokenExpired,
  subscribeToServerStatus
} from "./services/apiClient.js";
import { completeGoogleRegistration } from './services/googleAuthService.js';
import { clearPushContext } from "./services/pushNotificationService.js";
import { getPublicPageTitle, setDocumentPageTitle } from './lib/pageTitle.js';
import { clearLandingBookingIntent, consumeLandingBookingRoute, landingBookingRoute } from './lib/landingBookingIntent.js';

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
  return normalizedHost === 'status.ipawcus.com'
    || normalizedHost.startsWith('status.')
    || normalizedHost.startsWith('tv.');
}

function getViewFromPath(pathname) {
  if (isStatusDisplayHost(window.location.hostname)) {
    return 'statusDisplay';
  }

  if (pathname === routes.statusDisplay || pathname.startsWith(`${routes.statusDisplay}/`)) {
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
    return { view: 'dashboard', path: landingBookingRoute(storedUser) || routes.dashboard };
  }

  if (!storedUser && viewName === 'dashboard') {
    return { view: 'login', path: routes.login };
  }

  if (viewName === 'registerProfile' && !registrationEmail) {
    return { view: 'register', path: routes.register };
  }

  return { view: viewName, path: null };
}

function getStoredUserForSession() {
  const storedUser = localStorage.getItem('currentUser');
  if (!storedUser) {
    return null;
  }

  if (isStoredAuthTokenExpired()) {
    expireStoredAuthSession(undefined, { redirect: false });
    return null;
  }

  try {
    return JSON.parse(storedUser);
  } catch {
    clearStoredAuthSession();
    return null;
  }
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
  googleOnboardingToken: '',
};

function App() {
  const [view, setView] = useState(() => {
    const storedUser = getStoredUserForSession();
    return getRouteRedirect(getViewFromPath(window.location.pathname), storedUser).view;
  });
  const [currentUser, setCurrentUser] = useState(() => {
    return getStoredUserForSession();
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
      const storedUser = getStoredUserForSession();

      if (nextView === 'statusDisplay') {
        setCurrentUser(storedUser);
        setView(nextView);
        return;
      }

      if (nextView === 'dashboard' && !storedUser) {
        window.history.replaceState({}, '', routes.login);
        setView('login');
        return;
      }
      
      if (['login', 'landing', 'register', 'registerProfile', 'verifyEmail', 'forgotPassword'].includes(nextView) && storedUser) {
        window.history.replaceState({}, '', consumeLandingBookingRoute(storedUser) || routes.dashboard);
        setView('dashboard');
        setCurrentUser(storedUser);
        return;
      }

      setCurrentUser(storedUser);
      setView(nextView);
    };

    window.addEventListener('popstate', handlePopState);

    // Initial check for authenticated user on public routes
    const storedUser = getStoredUserForSession();
    const currentView = getViewFromPath(window.location.pathname);
    const redirect = getRouteRedirect(currentView, storedUser);
    
    if (redirect.path) {
      window.history.replaceState({}, '', redirect.path);
      if (storedUser && redirect.view === 'dashboard') clearLandingBookingIntent();
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

  useEffect(() => {
    if (serverStatus.isDown) {
      setDocumentPageTitle('Service Unavailable');
      return;
    }

    const nextActiveView = getRouteRedirect(view, currentUser, registrationData.email).view;
    if (nextActiveView !== 'dashboard') {
      setDocumentPageTitle(getPublicPageTitle(nextActiveView));
    }
  }, [currentUser, registrationData.email, serverStatus.isDown, view]);

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

  const handleLoginSuccess = useCallback((user) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    navigateTo(consumeLandingBookingRoute(user) || routes.dashboard);
  }, [navigateTo]);

  const handleGoogleAuthenticated = useCallback((result) => {
    const user = result?.user;
    const token = result?.access_token;

    if (!user || !token) {
      toast.error('Google sign-in returned an incomplete session. Please try again.');
      return;
    }

    localStorage.setItem('authToken', token);
    if (result.expires_at) {
      localStorage.setItem(AUTH_EXPIRES_AT_KEY, result.expires_at);
    } else {
      localStorage.removeItem(AUTH_EXPIRES_AT_KEY);
    }
    toast.success(`Welcome, ${user.firstName || 'User'}!`);
    handleLoginSuccess(user);
  }, [handleLoginSuccess]);

  const handleGoogleOnboarding = useCallback((result) => {
    const profile = result?.profile || {};
    const onboardingToken = result?.onboardingToken || '';

    if (!profile.email || !onboardingToken) {
      toast.error('Google registration could not be started. Please try again.');
      return;
    }

    setRegistrationData({
      ...initialRegistrationData,
      email: profile.email,
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      googleOnboardingToken: onboardingToken,
    });
    setRegistrationFlowKey((currentValue) => currentValue + 1);
    navigateTo(routes.registerProfile);
  }, [navigateTo]);

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
    clearPushContext().catch(() => {});
    clearStoredAuthSession();
    setCurrentUser(null);
    navigateTo(routes.landing);
  }, [navigateTo]);

  const handleAuthenticatedForgotPassword = useCallback(() => {
    const accountEmail = currentUser?.email
      || currentUser?.mail_Address
      || currentUser?.mailAddress
      || '';

    clearStoredAuthSession();
    setCurrentUser(null);
    setForgotPasswordEmail(accountEmail);
    navigateTo(routes.forgotPassword);
  }, [currentUser, navigateTo]);

  const handleRegistrationContinue = (accountData) => {
    setRegistrationData(accountData);
    navigateTo(routes.registerProfile);
  };

  const handleRegistrationComplete = async (profileData) => {
    const completedRegistration = {
      ...registrationData,
      ...profileData,
    };

    if (registrationData.googleOnboardingToken) {
      try {
        const result = await completeGoogleRegistration({
          ...profileData,
          onboardingToken: registrationData.googleOnboardingToken,
        });
        resetRegistrationFlow();
        toast.success('Your pet owner account is ready.');
        handleGoogleAuthenticated(result);
      } catch (error) {
        console.error('Google registration failed:', error);
        toast.error(error.message || 'Google registration could not be completed.');

        if (error?.data?.code === 'GOOGLE_ONBOARDING_EXPIRED') {
          resetRegistrationFlow();
          navigateTo(routes.register);
        }
      }
      return;
    }

    try {
      const result = await registerUser(completedRegistration);
      const verificationEmail = result.email || completedRegistration.email;
      localStorage.setItem('pendingVerificationEmail', verificationEmail);
      setPendingVerificationEmail(verificationEmail);
      toast.success({
        title: 'Continue email verification',
        description: result.message
          || 'Check your inbox for your latest verification code or request a new code from the verification screen.'
      });
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
        key={`${serverStatus.kind}:${serverStatus.code}:${serverStatus.status}`}
        isRetrying={isCheckingServer}
        onRetry={retryServerConnection}
        serverStatus={serverStatus}
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
      <div
        data-motion-page={activeView}
        className={activeView === 'dashboard'
          ? 'min-h-screen theme-aware'
          : activeView === 'statusDisplay'
            ? 'min-h-screen'
            : 'min-h-screen theme-static-light'}
      >
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
                onGoogleAuthenticated={handleGoogleAuthenticated}
                onGoogleOnboarding={handleGoogleOnboarding}
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
            <Dashboard
              user={currentUser}
              onLogout={handleLogout}
              onUserUpdate={handleUserUpdate}
              onForgotPassword={handleAuthenticatedForgotPassword}
            />
        )}

        {activeView === 'register' && (
            <RegistrationForm
                key={`register-${registrationFlowKey}`}
                onBackHome={() => navigateTo(routes.landing)}
                onLogin={() => navigateTo(routes.login)}
                initialValues={registrationData}
                onContinue={handleRegistrationContinue}
                onGoogleAuthenticated={handleGoogleAuthenticated}
                onGoogleOnboarding={handleGoogleOnboarding}
            />
        )}

        {activeView === 'registerProfile' && (
            <PetOwnerProfileForm
                key={`register-profile-${registrationFlowKey}`}
                email={registrationData.email}
                initialValues={registrationData}
                onBack={() => navigateTo(routes.register, { preserveRegistration: true })}
                onComplete={handleRegistrationComplete}
            />
        )}
      </div>
    </Suspense>
  );
}

export default App;
