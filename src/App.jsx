import { useEffect, useState, useCallback } from 'react';

import { LandingPage } from "./components/landingpage.jsx";
import { Login } from "./components/Login.jsx";
import Dashboard from "./components/Dashboard.jsx";
import { RegistrationForm } from "./components/Registration.jsx";
import { PetOwnerProfileForm } from "./components/petownerprofileRegistration.jsx";
import { registerUser } from "./services/registerUser.js";
import { ToastViewport, toast } from "./reusecomponent/toast.jsx";

const routes = {
  landing: '/landing',
  login: '/landing/login',
  dashboard: '/dashboard',
  register: '/landing/register',
  registerProfile: '/landing/register/profile',
};

function getViewFromPath(pathname) {
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
    case routes.landing:
    default:
      return 'landing';
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
};

function App() {
  const [view, setView] = useState(() => getViewFromPath(window.location.pathname));
  const [currentUser, setCurrentUser] = useState(() => {
    const storedUser = localStorage.getItem('currentUser');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [registrationData, setRegistrationData] = useState(initialRegistrationData);
  const [registrationFlowKey, setRegistrationFlowKey] = useState(0);

  useEffect(() => {
    const handlePopState = () => {
      const nextView = getViewFromPath(window.location.pathname);
      const storedUser = localStorage.getItem('currentUser');

      if (nextView === 'dashboard' && !storedUser) {
        window.history.replaceState({}, '', routes.login);
        setView('login');
        return;
      }
      
      if ((nextView === 'login' || nextView === 'landing' || nextView === 'register') && storedUser) {
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
    
    if (storedUser && (currentView === 'landing' || currentView === 'login' || currentView === 'register')) {
      window.history.replaceState({}, '', routes.dashboard);
      setView('dashboard');
    } else if (!storedUser && currentView === 'dashboard') {
      window.history.replaceState({}, '', routes.login);
      setView('login');
    }

    if (window.location.pathname === '/' && !storedUser) {
      window.history.replaceState({}, '', routes.landing);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    if (view === 'dashboard' && !currentUser) {
      window.history.replaceState({}, '', routes.login);
      setView('login');
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [currentUser, view]);

  useEffect(() => {
    if (view === 'registerProfile' && !registrationData.email) {
      window.history.replaceState({}, '', routes.register);
      setView('register');
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [view, registrationData.email]);

  const resetRegistrationFlow = () => {
    setRegistrationData(initialRegistrationData);
    setRegistrationFlowKey((currentValue) => currentValue + 1);
  };

  const navigateTo = (path, options = {}) => {
    const shouldResetRegistration = path === routes.register && !options.preserveRegistration;

    if (shouldResetRegistration) {
      resetRegistrationFlow();
    }

    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }

    setView(getViewFromPath(path));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
  }, []);

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
      await registerUser(completedRegistration);
      toast.success('Registration completed successfully!');
      resetRegistrationFlow();
      navigateTo(routes.login);
    } catch (error) {
      console.error('Registration failed:', error);
      toast.error(error.message || 'Registration failed.');
    }
  };

  return (
      <div className="min-h-screen">
        <ToastViewport />
        {view === 'landing' && (
            <LandingPage
                onLogin={() => navigateTo(routes.login)}
                onRegister={() => navigateTo(routes.register)}
            />
        )}

        {view === 'login' && (
            <Login
                onLogin={handleLoginSuccess}
                onBack={() => navigateTo(routes.landing)}
                onRegister={() => navigateTo(routes.register)}
            />
        )}

        {view === 'dashboard' && currentUser && (
            <Dashboard user={currentUser} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
        )}

        {view === 'register' && (
            <RegistrationForm
                key={`register-${registrationFlowKey}`}
                onBackHome={() => navigateTo(routes.landing)}
                onLogin={() => navigateTo(routes.login)}
                initialValues={registrationData}
                onContinue={handleRegistrationContinue}
            />
        )}

        {view === 'registerProfile' && (
            <PetOwnerProfileForm
                key={`register-profile-${registrationFlowKey}`}
                email={registrationData.email}
                onBack={() => navigateTo(routes.register, { preserveRegistration: true })}
                onComplete={handleRegistrationComplete}
            />
        )}
      </div>
  );
}

export default App;
