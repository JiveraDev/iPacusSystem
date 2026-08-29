import PropTypes from 'prop-types';

import ModernLandingPageContent from './ModernLandingPageContent.jsx';

export default function DiscardedLandingPage({ onLogin, onRegister }) {
    return <ModernLandingPageContent onLogin={onLogin} onRegister={onRegister} />;
}

DiscardedLandingPage.propTypes = {
    onLogin: PropTypes.func,
    onRegister: PropTypes.func,
};
