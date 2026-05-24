import svgPaths from "../assets/imports/svg1.js";
import vetImage from "../assets/vetImage.png";
import consultImage from "../assets/consultimage.png";
import logoImage from "../assets/circular_logo.png";

const features = [
  "Expert Veterinarians",
  "Daily 8AM - 6PM",
  "Full Grooming Services",
  "Digital Medical Records",
];

const announcements = [
  {
    title: "Holiday Schedule",
    text: "Our clinic will have modified hours during the upcoming holiday season. Regular appointments are available, and emergency services remain 24/7.",
    date: "Posted: Feb 1, 2026",
  },
  {
    title: "Free Health Checkup Week",
    text: "Join us for our annual Free Health Checkup Week from Feb 10-16. Book your appointment online to ensure your pet's wellness!",
    date: "Posted: Jan 28, 2026",
  },
  {
    title: "Online Consultations Now Available",
    text: "We're excited to announce our new online consultation service! Get expert advice from the comfort of your home.",
    date: "Posted: Jan 25, 2026",
  },
];

const steps = [
  {
    title: "Register an Account",
    text: "Create your account and add your pet's information to get started.",
  },
  {
    title: "Select Available Time",
    text: "Choose from our veterinarians' available time slots. Bookings are available for next day onwards.",
  },
  {
    title: "Complete Payment",
    text: "Secure online payment via Maya. You'll receive a confirmation immediately after payment.",
  },
  {
    title: "Join the Consultation",
    text: "Access your consultation link at the scheduled time through your dashboard.",
  },
];

const guidelines = [
  "Please arrive 10 minutes before your scheduled appointment",
  "Bring your pet's vaccination records for first visits",
  "Keep your pet on a leash or in a carrier for safety",
  "Inform us of any behavioral concerns before your visit",
  "Payment can be made via cash, card, or online transfer",
];

const quickLinks = ["About Clinic", "Announcements", "Online Consultation"];
const services = [
  "Consultations & Check-ups",
  "Vaccinations & Prevention",
  "Surgical Procedures",
  "Laboratory Diagnostics",
  "Pet Grooming Services",
];

export default function LandingPageContent({ onLogin }) {
  return (
    <div className="min-w-0 bg-white text-slate-900">
      <header className="border-b border-black/10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="iPawcus logo" className="h-10 w-10 object-contain" />
            <div className="font-['Montserrat:Bold',sans-serif] text-xl font-bold text-[#155dfc] sm:text-2xl">
              iPawcus
            </div>
          </div>
          <div className="flex items-center gap-3">

            <button
              type="button"
              onClick={onLogin}
              className="rounded-lg bg-[#1B56FD] px-4 py-2 text-sm text-white"
            >
              Login
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 py-10 text-center sm:px-6 sm:py-16">
        <div
            className="mx-auto mb-6 inline-flex max-w-full items-center rounded-full bg-[#dbeafe] px-4 py-2 text-xs font-bold text-[#1447e6] sm:text-sm">
          * 4.4 Rating - Trusted by Pet Owners in Lucena City
        </div>
        <h1 className="mx-auto max-w-3xl text-3xl font-bold text-[#101828] sm:text-4xl md:text-5xl">
          Professional Pet Healthcare in Lucena City
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-[#4a5565] sm:text-lg">
          Vetfocus Care Animal Clinic - Your trusted partner for comprehensive veterinary services, grooming, and pet
          wellness
        </p>

        <button
            type="button"
            onClick={onLogin}
            className="mt-8 rounded-lg bg-[#030213] px-6 py-3 text-white"
        >
          Get Started Today
        </button>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-10">
          <div>
            <h2 className="text-2xl font-bold text-[#101828] sm:text-3xl">
              About Vetfocus Care Animal Clinic
            </h2>
            <p className="mt-4 text-[#4a5565]">
              Vetfocus Care Animal Clinic is a highly-rated veterinary facility known for providing reliable medical attention for pets with a focus on comprehensive care. With a strong 4.4 star rating, we are well-regarded by pet owners for our professional staff and quality medical services.
            </p>
            <p className="mt-4 text-[#4a5565]">
              Our clinic is equipped for essential veterinary care including professional consultations, physical examinations, surgical procedures, and laboratory diagnostics. We also provide preventative care, wellness programs, and a complete on-site pharmacy with prescription medications and pet care essentials.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {features.map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-[#0a0a0a]">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 20 20">
                    <path
                      d={svgPaths.p2f84f400}
                      stroke="#155DFC"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.66667"
                    />
                  </svg>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)]">
            <img src={vetImage} alt="Veterinarian examining pet" className="h-full w-full object-cover" />
          </div>
        </div>
      </section>

      <section className="bg-[#eff6ff]">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
          <h2 className="text-center text-2xl font-bold text-[#101828] sm:text-3xl">
            Latest Announcements
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {announcements.map((a) => (
              <div key={a.title} className="rounded-2xl border border-black/10 bg-white p-6">
                <div className="mb-4 flex items-center gap-2">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 20 20">
                    <path
                      d={svgPaths.p26ddc800}
                      stroke="#155DFC"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.66667"
                    />
                    <path
                      d={svgPaths.p35ba4680}
                      stroke="#155DFC"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.66667"
                    />
                  </svg>
                  <div className="text-sm font-medium text-[#0a0a0a]">{a.title}</div>
                </div>
                <p className="text-sm text-[#4a5565]">{a.text}</p>
                <p className="mt-4 text-xs text-[#6a7282]">{a.date}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
          <h2 className="text-center text-2xl font-bold text-[#101828] sm:text-3xl">
            How to Book an Online Consultation
          </h2>
          <div className="mt-10 grid gap-10 lg:grid-cols-2">
            <div className="space-y-6">
              {steps.map((s, idx) => (
                <div key={s.title} className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#155dfc] text-sm font-bold text-white">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="text-lg font-bold text-[#0a0a0a]">{s.title}</div>
                    <div className="mt-1 text-sm text-[#4a5565]">{s.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="overflow-hidden rounded-xl shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)]">
              <img src={consultImage} alt="Online consultation" className="h-full w-full object-cover" />
            </div>
          </div>
          <div className="mt-10 rounded-2xl border border-[#bedbff] bg-[#eff6ff] p-6">
            <div className="text-sm font-medium text-[#0a0a0a]">Consultation Fee</div>
            <p className="mt-2 text-sm text-[#364153]">
              Online consultations are priced at <span className="font-bold text-[#155dfc]">PHP 500 per session</span>. This includes a 30-minute video call with our experienced veterinarians and a follow-up summary report.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#f9fafb]">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
          <h2 className="text-center text-2xl font-bold text-[#101828] sm:text-3xl">
            Clinic Information & Guidelines
          </h2>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-black/10 bg-white p-6">
              <div className="text-sm font-medium text-[#0a0a0a]">Operating Hours</div>
              <div className="mt-4 flex items-center justify-between text-sm text-[#0a0a0a]">
                <span>Every Day:</span>
                <span>8:00 AM - 6:00 PM</span>
              </div>
              <p className="mt-3 text-sm text-[#4a5565]">
                Open daily with consistent hours for your convenience
              </p>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white p-6">
              <div className="text-sm font-medium text-[#0a0a0a]">Contact Information</div>
              <div className="mt-4 text-sm text-[#0a0a0a]">Address:</div>
              <div className="mt-2 text-sm text-[#364153]">
                Oakbrook Avenue, Phase 3, Pleasantville Subdivision, Corner Clayton, Ilayang Iyam, Lucena City
              </div>
              <div className="mt-4 text-sm text-[#0a0a0a]">Phone: (042) 373-5678</div>
              <div className="mt-2 text-sm text-[#0a0a0a]">Email: info@vetfocuscare.com</div>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white p-6 lg:col-span-2">
              <div className="text-sm font-medium text-[#0a0a0a]">Visit Guidelines</div>
              <ul className="mt-4 space-y-2 text-sm text-[#364153]">
                {guidelines.map((g) => (
                  <li key={g} className="flex items-start gap-2">
                    <span className="text-[#155dfc]">-</span>
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#f9fafb]">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 text-[#99a1af] sm:px-6 sm:py-12">
          <div className="grid gap-8 lg:grid-cols-3">
            <div>
              <div className="flex items-center gap-2 text-black">
                <img
                  src={logoImage}
                  alt="Logo"
                  className="h-8 w-8 object-contain bg-transparent"
                />
                <span className="text-lg font-bold">Vetfocus Care</span>
              </div>
              <p className="mt-4 text-sm">
                Providing professional and compassionate veterinary care to pets in Lucena City.
              </p>
            </div>
            <div>
              <div className="text-sm font-bold text-neutral-800">Quick Links</div>
              <ul className="mt-4 space-y-2 text-sm">
                {quickLinks.map((link) => (
                  <li key={link}>{link}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-sm font-bold text-neutral-800">Services</div>
              <ul className="mt-4 space-y-2 text-sm">
                {services.map((service) => (
                  <li key={service}>{service}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-black pt-6 text-center text-sm text-black">
            (c) 2026 Vetfocus Care Animal Clinic. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
