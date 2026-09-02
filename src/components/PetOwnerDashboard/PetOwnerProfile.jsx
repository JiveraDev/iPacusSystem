import { useEffect, useState } from "react";
import { Card, CardContent } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Tabs, TabsContent } from "../../ui/tabs";
import { toast } from "../../reusecomponent/toast.jsx";
import { User, Mail, Phone, MapPin, Calendar, Loader2, Pencil, Save, X } from "lucide-react";
import { useUserUpdate, useDashboardUser } from "../dashboardRouter.jsx";
import PasswordChangeCard from "../shared/PasswordChangeCard.jsx";
import ThemeToggle from "../shared/ThemeToggle.jsx";
import NotificationPreferencesCard from "../shared/NotificationPreferencesCard.jsx";
import ProfileWorkspaceHeader from "../shared/ProfileWorkspaceHeader.jsx";
import UnsavedProfileChangesDialog from "../shared/UnsavedProfileChangesDialog.jsx";
import {
  PROFILE_DISPLAY_VALUE_CLASS,
  profileInputClass,
  profileLabelClass
} from "../shared/profileUiStyles.js";
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

export default function PetOwnerProfile({ onForgotPassword }) {
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
  const [activeTab, setActiveTab] = useState("profile");
  const [pendingProfileTab, setPendingProfileTab] = useState("");
  const [isProfileLeaveDialogOpen, setIsProfileLeaveDialogOpen] = useState(false);

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
      return false;
    }

    const nextPhoneError = getPhilippinePhoneError(profileData.phone, { optional: true });
    if (nextPhoneError) {
      setPhoneError(nextPhoneError);
      toast.error(nextPhoneError);
      return false;
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
      return true;
    } catch (error) {
      console.error("Save error:", error);
      toast.error(error.message || "Error saving changes");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleProfileTabChange = (nextTab) => {
    if (nextTab === activeTab) return;

    if (activeTab === "profile" && isEditingProfile) {
      setPendingProfileTab(nextTab);
      setIsProfileLeaveDialogOpen(true);
      return;
    }

    setActiveTab(nextTab);
  };

  const handleStayOnProfile = () => {
    setPendingProfileTab("");
    setIsProfileLeaveDialogOpen(false);
    setActiveTab("profile");
  };

  const handleSaveAndLeaveProfile = async () => {
    const saved = await handleSaveProfile();
    if (!saved) return;

    setIsProfileLeaveDialogOpen(false);
    setActiveTab(pendingProfileTab || "profile");
    setPendingProfileTab("");
  };

  const profileImageSrc = profileData.profileImage;
  const displayName = profileData.firstName || profileData.lastName
    ? `${profileData.firstName} ${profileData.lastName}`.trim()
    : "User Profile";
  const currentAgeLabel = formatAgeYearsOnly(profileData.dateOfBirth);
  const inputClass = profileInputClass("px-4 shadow-sm focus:border-blue-500 focus:ring-blue-500/20");

  return (
    <div className="mx-auto max-w-6xl px-0">
      <Tabs
        value={activeTab}
        onValueChange={handleProfileTabChange}
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <ProfileWorkspaceHeader
          activeTab={activeTab}
          accountLabel="Pet Owner Account"
          displayName={displayName}
          secondaryLabel={profileData.email || "Contact email not set"}
          imageSrc={profileImageSrc}
          imageUnavailable={imageError && Boolean(profileData.profileImage)}
          isEditing={isEditingProfile}
          onImageChange={handleImageChange}
          onImageError={setImageError}
          action={activeTab === "profile" && !isEditingProfile ? (
            <Button
              onClick={() => setIsEditingProfile(true)}
              className="h-11 w-full bg-white px-5 text-sm font-black text-blue-800 shadow-sm hover:bg-blue-50 sm:w-auto"
            >
              <Pencil className="h-4 w-4" />
              Edit Profile
            </Button>
          ) : null}
        />

        <TabsContent value="profile" className="m-0 outline-none">
          <Card className="overflow-hidden rounded-none border-0 bg-white shadow-none dark:bg-slate-900">
            <CardContent className="space-y-6 px-5 py-6 sm:px-6 lg:px-8 lg:py-8">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-black text-slate-950 dark:text-white">Owner information</h3>
                  {isEditingProfile ? (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                      Editing profile
                    </span>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <ProfileField htmlFor="firstName" label="First Name" icon={<User className="h-4 w-4 text-slate-400" />}>
                    <Input
                      id="firstName"
                      value={profileData.firstName}
                      onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                      restriction="name"
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
                      restriction="name"
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
                      restriction="phone"
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
                            placeholder="Street and city"
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

        <TabsContent value="security" className="m-0 bg-slate-50/70 p-4 outline-none dark:bg-slate-950/40 sm:p-6">
          <PasswordChangeCard userId={passwordUserId} onForgotPassword={onForgotPassword} />
        </TabsContent>

        <TabsContent value="notifications" className="m-0 bg-slate-50/70 p-4 outline-none dark:bg-slate-950/40 sm:p-6">
          <NotificationPreferencesCard user={passwordUser} />
        </TabsContent>

        <TabsContent value="appearance" className="m-0 bg-slate-50/70 p-4 outline-none dark:bg-slate-950/40 sm:p-6">
          <ThemeToggle />
        </TabsContent>
      </Tabs>

      <UnsavedProfileChangesDialog
        open={isProfileLeaveDialogOpen}
        onStay={handleStayOnProfile}
        onSave={handleSaveAndLeaveProfile}
        isSaving={isSaving}
      />
    </div>
  );
}

function ProfileField({ htmlFor, label, icon, children, className = "" }) {
  return (
    <div className={`min-w-0 space-y-2 ${className}`}>
      <Label htmlFor={htmlFor} className={profileLabelClass()}>
        {icon}
        {label}
      </Label>
      {children}
    </div>
  );
}

function ReadOnlyValue({ value }) {
  return (
    <div className={`${PROFILE_DISPLAY_VALUE_CLASS} min-w-0 px-4 text-base md:text-sm`}>
      {value || <span className="font-medium text-slate-400">Not set</span>}
    </div>
  );
}
