import { useEffect, useState } from "react";
import { Card, CardContent, CardTitle, CardDescription } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { toast } from "../../reusecomponent/toast.jsx";
import { User, Mail, Phone, MapPin, Calendar, Camera, Loader2, Clock, Pencil, Save, X } from "lucide-react";
import { useUserUpdate, useDashboardUser } from "../dashboardRouter.jsx";
import PasswordChangeCard from "../shared/PasswordChangeCard.jsx";
import ThemeToggle from "../shared/ThemeToggle.jsx";
import NotificationPreferencesCard from "../shared/NotificationPreferencesCard.jsx";
import { uploadImageFile } from "../../services/uploadService";
import { fetchUser, updateUser } from "../../services/userService";
import { getPhilippinePhoneError, normalizePhilippinePhoneForSubmit, normalizePhilippinePhoneInput } from "../../lib/philippinePhone";

function parseProfileDate(value) {
  if (!value) return null;

  const datePart = String(value).split(" ")[0];
  const date = /^\d{4}-\d{2}-\d{2}$/.test(datePart)
    ? new Date(`${datePart}T00:00:00`)
    : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatAgeYearsOnly(value) {
  const birthDate = parseProfileDate(value);
  if (!birthDate) return "Not set";

  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

  if (!hasBirthdayPassed) years -= 1;
  if (years < 0) return "Not set";

  return `${years} ${years === 1 ? "year" : "years"} old`;
}

export default function PetOwnerProfile({ onLogout }) {
  const onUserUpdate = useUserUpdate();
  const contextUser = useDashboardUser();
  const passwordUser = contextUser || JSON.parse(localStorage.getItem("currentUser") || "{}");
  const passwordUserId = passwordUser.id || passwordUser.user_id;
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [imageError, setImageError] = useState(false);

  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: normalizePhilippinePhoneInput(""),
    address: "",
    dateOfBirth: "",
    profileImage: "",
  });
  
  const [imageFile, setImageFile] = useState(null);
  const [phoneError, setPhoneError] = useState("");

  // Helper to normalize user data from various possible property names
  const normalizeUser = (u) => {
    if (!u) return {
      firstName: "",
      lastName: "",
      email: "",
      phone: normalizePhilippinePhoneInput(""),
      address: "",
      dateOfBirth: "",
      profileImage: "",
    };

    return {
      firstName: u.firstName || u.first_Name || u.first_name || "",
      lastName: u.lastName || u.last_Name || u.last_name || "",
      email: u.email || u.mail_Address || "",
      phone: normalizePhilippinePhoneInput(u.phone || u.phoneNumber || ""),
      address: u.address || u.personal_Address || "",
      dateOfBirth: u.birthdate || u.dateOfBirth || "",
      profileImage: u.profileImage || u.setProfilePic_url || "",
    };
  };

  // 1. Fetch fresh data from DB every time the component mounts or context user changes
  useEffect(() => {
    const fetchUserData = async () => {
      const user = contextUser || JSON.parse(localStorage.getItem("currentUser") || "{}");
      const userId = user.id || user.user_id;
      
      if (!userId) return;

      try {
        const latestUser = await fetchUser(userId);
        const normalized = normalizeUser(latestUser);

        // Sync local storage and state with the absolute source of truth (DB)
        const currentLocal = JSON.parse(localStorage.getItem("currentUser") || "{}");
        
        const hasChanges = 
          normalized.profileImage !== currentLocal.profileImage || 
          normalized.firstName !== (currentLocal.firstName || currentLocal.first_Name) || 
          normalized.lastName !== (currentLocal.lastName || currentLocal.last_Name) ||
          normalized.dateOfBirth !== (currentLocal.birthdate || currentLocal.dateOfBirth) ||
          normalized.phone !== (currentLocal.phoneNumber || currentLocal.phone) ||
          normalized.address !== (currentLocal.address || currentLocal.personal_Address);

        if (hasChanges) {
            const updatedLocalUser = { 
              ...currentLocal, 
              ...normalized, 
              birthdate: normalized.dateOfBirth,
              phoneNumber: normalized.phone,
              personal_Address: normalized.address,
              setProfilePic_url: normalized.profileImage
            };
            localStorage.setItem("currentUser", JSON.stringify(updatedLocalUser));
            if (onUserUpdate) onUserUpdate(updatedLocalUser);
        }

        setProfileData(normalized);
        setImageError(false);
      } catch (error) {
        console.error("Profile sync error:", error);
        setProfileData(normalizeUser(user));
        setImageError(false);
      }
    };

    fetchUserData();
  }, [onUserUpdate, contextUser]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      // Temporary local preview
      setProfileData(prev => ({ ...prev, profileImage: URL.createObjectURL(file) }));
      setImageError(false);
    }
  };

  const handleSaveProfile = async () => {
    const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const userId = user.id || user.user_id;

    if (!userId) {
      toast.error("Session error. Please log in again.");
      return;
    }

    const nextPhoneError = getPhilippinePhoneError(profileData.phone, { optional: true });
    if (nextPhoneError) {
      setPhoneError(nextPhoneError);
      toast.error(nextPhoneError);
      return;
    }

    setPhoneError("");
    const normalizedPhone = normalizePhilippinePhoneForSubmit(profileData.phone, { optional: true });
    setIsSaving(true);
    let finalImageUrl = profileData.profileImage;

    try {
      // 1. Upload image if a new one was selected
      if (imageFile) {
        finalImageUrl = await uploadImageFile(imageFile, 'user');
      }

      // 2. Save profile data to DB
      const result = await updateUser(userId, {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        phoneNumber: normalizedPhone,
        address: profileData.address,
        dateOfBirth: profileData.dateOfBirth,
        profileImage: finalImageUrl
      });

      // 3. Update local state and global context
      const serverUser = result.user ? normalizeUser(result.user) : null;
      
      const updatedUser = {
        ...user,
        firstName: serverUser?.firstName || profileData.firstName,
        lastName: serverUser?.lastName || profileData.lastName,
        phoneNumber: serverUser?.phone || normalizedPhone,
        phone: serverUser?.phone || normalizedPhone,
        address: serverUser?.address || profileData.address,
        personal_Address: serverUser?.address || profileData.address,
        birthdate: serverUser?.dateOfBirth || profileData.dateOfBirth,
        dateOfBirth: serverUser?.dateOfBirth || profileData.dateOfBirth,
        profileImage: serverUser?.profileImage || finalImageUrl,
        setProfilePic_url: serverUser?.profileImage || finalImageUrl,
      };
      
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));
      if (onUserUpdate) onUserUpdate(updatedUser);

      setProfileData(normalizeUser(updatedUser));
      setImageError(false);
      
      setIsEditingProfile(false);
      setImageFile(null);
      toast.success("Profile saved successfully!");
    } catch (error) {
      console.error("Save error:", error);
      toast.error(error.message || "Error saving changes");
    } finally {
      setIsSaving(false);
    }
  };

  // Build the final image URL for display
  const getImageSrc = () => {
    if (!profileData.profileImage) return null;
    
    // 1. Blobs/Previews
    if (profileData.profileImage.startsWith('blob:') || profileData.profileImage.startsWith('data:')) {
      return profileData.profileImage;
    }
    
    // 2. Absolute URLs
    if (profileData.profileImage.startsWith('http')) {
      return profileData.profileImage;
    }

    // 3. Vite Assets from 'public' folder
    // In Vite, contents of 'public/' are served at the root '/'.
    // If path is '/public/uploads/xxx.png', it's actually at '/uploads/xxx.png'
    let path = profileData.profileImage;
    
    // Remove leading/trailing whitespace and ensure it's a string
    path = String(path).trim();
    
    // Strip '/public' or 'public' prefix if present
    const cleanPath = path.replace(/^\/?public\//, '/');
    
    // Ensure it starts with a single slash
    const finalPath = cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath;
    
    // We request it from the CURRENT origin (Vite dev server)
    return finalPath;
  };

  const profileImageSrc = getImageSrc();
  const displayName = profileData.firstName || profileData.lastName
    ? `${profileData.firstName} ${profileData.lastName}`.trim()
    : "User Profile";
  const currentAgeLabel = formatAgeYearsOnly(profileData.dateOfBirth);
  const inputClass = "h-11 rounded-lg border-slate-200 bg-white px-4 text-base text-slate-950 shadow-sm transition-all focus:border-blue-500 focus:ring-blue-500/20 disabled:border-slate-200 disabled:bg-white disabled:text-slate-950 disabled:opacity-100 md:text-sm";

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-0">
      <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-blue-700">Pet Owner Account</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">Profile Settings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
            Keep the owner details used for appointment records, queue updates, and clinic contact.
          </p>
        </div>
        {!isEditingProfile && (
          <Button
            onClick={() => setIsEditingProfile(true)}
            className="h-11 w-full rounded-lg bg-[#155dfc] px-5 text-sm font-semibold shadow-sm hover:bg-blue-700 sm:w-auto"
          >
            <Pencil className="h-4 w-4" />
            Edit Profile
          </Button>
        )}
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-6 grid h-auto w-full grid-cols-2 rounded-lg bg-slate-100 p-1 text-slate-600 sm:inline-grid sm:w-auto sm:grid-cols-4">
          <TabsTrigger value="profile" className="rounded-md px-4 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm sm:px-7">
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="rounded-md px-4 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm sm:px-7">
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-md px-4 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm sm:px-7">
            Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance" className="rounded-md px-4 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm sm:px-7">
            Appearance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="outline-none">
          <Card className="overflow-hidden rounded-lg border-slate-200 bg-white shadow-sm">
            <div className="h-16 bg-slate-950" />
            <CardContent className="space-y-6 px-5 py-6 sm:px-6">
              <div className="flex flex-col gap-5 border-b border-slate-100 pb-6 md:flex-row md:items-end md:justify-between">
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end">
                  <div className="relative shrink-0">
                    <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-md ring-1 ring-slate-200">
                      {profileImageSrc && !imageError ? (
                        <img
                          src={profileImageSrc}
                          alt="Profile"
                          onLoad={() => setImageError(false)}
                          onError={() => setImageError(true)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-100">
                          <User className="h-12 w-12 text-slate-400" />
                        </div>
                      )}
                    </div>
                    {isEditingProfile && (
                      <label
                        className="absolute bottom-1 right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-[#155dfc] text-white shadow-sm transition hover:bg-blue-700"
                        title="Upload profile photo"
                      >
                        <Camera className="h-4 w-4" />
                        <input type="file" className="hidden" onChange={handleImageChange} accept="image/*" />
                      </label>
                    )}
                  </div>

                  <div className="min-w-0 sm:pb-1">
                    <h2 className="max-w-full break-words text-xl font-bold text-slate-950">{displayName}</h2>
                    <p className="mt-1 inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                      Pet Owner
                    </p>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                      {isEditingProfile
                        ? "Update the owner contact record that clinic staff can use during service visits."
                        : "Owner information is synced from the database and used by clinic staff for service coordination."}
                    </p>
                  </div>
                </div>

                {imageError && profileData.profileImage && !isEditingProfile && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 md:max-w-sm">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Image path might be broken. Try re-uploading your photo.</span>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div>
                  <CardTitle className="text-xl font-bold text-slate-950">Profile Details</CardTitle>
                  <CardDescription className="mt-1 text-sm text-slate-600">
                    {isEditingProfile
                      ? "Edit the fields below, then save the profile."
                      : "Owner information is synced from the database and used by clinic staff for service coordination."}
                  </CardDescription>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <ProfileField htmlFor="firstName" label="First Name" icon={<User className="h-4 w-4 text-slate-400" />}>
                    <Input
                      id="firstName"
                      value={profileData.firstName}
                      onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                      disabled={!isEditingProfile || isSaving}
                      className={inputClass}
                      placeholder="First Name"
                    />
                  </ProfileField>

                  <ProfileField htmlFor="lastName" label="Last Name" icon={<User className="h-4 w-4 text-slate-400" />}>
                    <Input
                      id="lastName"
                      value={profileData.lastName}
                      onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                      disabled={!isEditingProfile || isSaving}
                      className={inputClass}
                      placeholder="Last Name"
                    />
                  </ProfileField>

                  <ProfileField htmlFor="email" label="Email Address" icon={<Mail className="h-4 w-4 text-slate-400" />}>
                    <Input
                      id="email"
                      value={profileData.email}
                      disabled={true}
                      className={`${inputClass} cursor-default`}
                    />
                  </ProfileField>

                  <ProfileField htmlFor="phone" label="Phone Number" icon={<Phone className="h-4 w-4 text-slate-400" />}>
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => {
                        setPhoneError("");
                        setProfileData({ ...profileData, phone: normalizePhilippinePhoneInput(e.target.value) });
                      }}
                      disabled={!isEditingProfile || isSaving}
                      inputMode="tel"
                      maxLength={13}
                      className={`${inputClass} ${phoneError ? "border-red-500" : ""}`}
                      placeholder="+639"
                    />
                    {phoneError && <p className="mt-1 text-xs font-medium text-red-600">{phoneError}</p>}
                  </ProfileField>

                  <ProfileField htmlFor="dob" label={isEditingProfile ? "Date of Birth" : "Current Age"} icon={<Calendar className="h-4 w-4 text-slate-400" />}>
                    {isEditingProfile ? (
                      <Input
                        id="dob"
                        type="date"
                        value={profileData.dateOfBirth ? profileData.dateOfBirth.split(' ')[0] : ""}
                        onChange={(e) => setProfileData({ ...profileData, dateOfBirth: e.target.value })}
                        disabled={isSaving}
                        className={inputClass}
                      />
                    ) : (
                      <ReadOnlyValue value={currentAgeLabel} />
                    )}
                  </ProfileField>

                  <ProfileField htmlFor="address" label="Residential Address" icon={<MapPin className="h-4 w-4 text-slate-400" />} className="md:col-span-2">
                    <Input
                      id="address"
                      value={profileData.address}
                      onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                      disabled={!isEditingProfile || isSaving}
                      className={inputClass}
                      placeholder="Street Number, Barangay, City, Province"
                    />
                  </ProfileField>
                </div>

                {isEditingProfile && (
                  <div className="flex flex-col justify-end gap-3 border-t border-slate-100 pt-6 sm:flex-row">
                    <Button
                      variant="outline"
                      disabled={isSaving}
                      onClick={() => {
                        setIsEditingProfile(false);
                        setImageFile(null);
                        setImageError(false);
                        setPhoneError("");
                        setProfileData(normalizeUser(contextUser || JSON.parse(localStorage.getItem("currentUser") || "{}")));
                      }}
                      className="h-11 rounded-lg border-slate-200 px-5 text-sm font-semibold hover:bg-slate-50"
                    >
                      <X className="h-4 w-4" />
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="h-11 rounded-lg bg-[#155dfc] px-6 text-sm font-semibold shadow-sm hover:bg-blue-700"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="outline-none">
          <PasswordChangeCard userId={passwordUserId} onForgotPassword={onLogout} />
        </TabsContent>

        <TabsContent value="notifications" className="outline-none">
          <NotificationPreferencesCard user={passwordUser} />
        </TabsContent>

        <TabsContent value="appearance" className="outline-none">
          <ThemeToggle />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileField({ htmlFor, label, icon, children, className = "" }) {
  return (
    <div className={`min-w-0 space-y-2 ${className}`}>
      <Label htmlFor={htmlFor} className="text-sm font-semibold text-slate-700">
        {icon}
        {label}
      </Label>
      {children}
    </div>
  );
}

function ReadOnlyValue({ value }) {
  return (
    <div className="flex h-11 min-w-0 items-center rounded-lg border border-slate-200 bg-white px-4 text-base font-semibold text-slate-950 md:text-sm">
      {value || "Not set"}
    </div>
  );
}
