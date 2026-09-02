import PropTypes from 'prop-types';

export default function ServicePetPeek({ kind, accent = 'blue' }) {
    const hasLongEars = kind === 'bunny';
    const hasPointedEars = kind === 'cat';
    const isParrot = kind === 'parrot';

    return (
        <span className={`landing-service-pet landing-service-pet--${accent}`} aria-hidden="true">
            <svg viewBox="0 0 96 82" role="presentation">
                {hasLongEars ? (
                    <>
                        <ellipse className="landing-service-pet__ear" cx="35" cy="20" rx="9" ry="23" transform="rotate(-12 35 20)" />
                        <ellipse className="landing-service-pet__ear" cx="62" cy="20" rx="9" ry="23" transform="rotate(12 62 20)" />
                    </>
                ) : (
                    <>
                        <path className="landing-service-pet__ear" d={hasPointedEars ? 'M27 32 31 9 46 27Z' : 'M24 30C15 16 20 8 38 24Z'} />
                        <path className="landing-service-pet__ear" d={hasPointedEars ? 'm53 27 15-18 3 25Z' : 'M58 24C77 8 81 19 69 33Z'} />
                    </>
                )}
                <ellipse className="landing-service-pet__head" cx="49" cy="45" rx="30" ry="27" />
                {isParrot ? (
                    <path className="landing-service-pet__muzzle" d="M45 48c14-13 27-4 21 8-7 7-15 7-23 0Z" />
                ) : (
                    <ellipse className="landing-service-pet__muzzle" cx="50" cy="54" rx="14" ry="10" />
                )}
                <circle className="landing-service-pet__eye" cx="38" cy="42" r="3.5" />
                <circle className="landing-service-pet__eye" cx="61" cy="42" r="3.5" />
                {!isParrot ? <circle className="landing-service-pet__nose" cx="50" cy="51" r="3.8" /> : null}
                <ellipse className="landing-service-pet__paw" cx="24" cy="70" rx="13" ry="9" transform="rotate(-18 24 70)" />
                <circle className="landing-service-pet__toe" cx="15" cy="64" r="3" />
                <circle className="landing-service-pet__toe" cx="22" cy="61" r="3" />
                <circle className="landing-service-pet__toe" cx="29" cy="63" r="3" />
            </svg>
        </span>
    );
}

ServicePetPeek.propTypes = {
    kind: PropTypes.oneOf(['dog', 'cat', 'bunny', 'parrot']).isRequired,
    accent: PropTypes.oneOf(['mint', 'coral', 'sun', 'blue']),
};
