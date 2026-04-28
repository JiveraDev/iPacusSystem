import { useEffect, useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { toast } from "../../reusecomponent/toast.jsx";
import { User, Mail, Phone, MapPin, Calendar, Camera, Loader2, Clock } from "lucide-react";
import { calculateAge } from "../../lib/date";
import { useUserUpdate, useDashboardUser } from "./dashboardRouter";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function PetOwnerProfile() {
  const onUserUpdate = useUserUpdate();
  const contextUser = useDashboardUser();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [imageError, setImageError] = useState(false);

  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    dateOfBirth: "",
    profileImage: "",
  });
  
  const [imageFile, setImageFile] = useState(null);

  // Helper to normalize user data from various possible property names
  const normalizeUser = (u) => {
    if (!u) return {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      address: "",
      dateOfBirth: "",
      profileImage: "",
    };

    return {
      firstName: u.firstName || u.first_Name || u.first_name || "",
      lastName: u.lastName || u.last_Name || u.last_name || "",
      email: u.email || u.mail_Address || "",
      phone: u.phone || u.phoneNumber || "",
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
        const response = await fetch(`${API_BASE_URL}/api/users/${userId}`);
        if (!response.ok) throw new Error("Failed to sync with database");
        
        const latestUser = await response.json();
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

    setIsSaving(true);
    let finalImageUrl = profileData.profileImage;

    try {
      // 1. Upload image if a new one was selected
      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        formData.append('type', 'user');
        
        const uploadRes = await fetch(`${API_BASE_URL}/api/upload`, {
          method: 'POST',
          body: formData
        });

        if (!uploadRes.ok) throw new Error("Image upload failed");
        const uploadResult = await uploadRes.json();
        finalImageUrl = uploadResult.url;
      }

      // 2. Save profile data to DB
      const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          phoneNumber: profileData.phone,
          address: profileData.address,
          dateOfBirth: profileData.dateOfBirth,
          profileImage: finalImageUrl
        })
      });

      if (!response.ok) throw new Error("Database update failed");
      const result = await response.json();

      // 3. Update local state and global context
      const serverUser = result.user ? normalizeUser(result.user) : null;
      
      const updatedUser = {
        ...user,
        firstName: serverUser?.firstName || profileData.firstName,
        lastName: serverUser?.lastName || profileData.lastName,
        phoneNumber: serverUser?.phone || profileData.phone,
        phone: serverUser?.phone || profileData.phone,
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

  return (
    <div className="space-y-8 max-w-5xl mx-auto px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Profile Settings</h1>
          <p className="text-slate-500 mt-1 text-lg">Manage your personal information and preferences.</p>
        </div>
        {!isEditingProfile && (
          <Button 
            onClick={() => setIsEditingProfile(true)} 
            className="w-full sm:w-auto px-10 h-12 text-base font-semibold shadow-lg bg-[#155dfc] hover:bg-blue-700 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Edit Profile
          </Button>
        )}
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="inline-flex h-12 items-center justify-center rounded-xl bg-slate-100 p-1 text-slate-500 mb-8">
          <TabsTrigger value="profile" className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-8 py-2 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm">
            Profile Details
          </TabsTrigger>
          <TabsTrigger value="security" className="inline-flex items-center justify-center whitespace-nowrap rounded-lg px-8 py-2 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-sm">
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-8 outline-none animate-in fade-in duration-300">
          <Card className="border-slate-200 shadow-xl rounded-2xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/80 border-b border-slate-100 px-8 py-6">
              <CardTitle className="text-2xl font-bold text-slate-800">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="p-8 sm:p-10 space-y-12">
              
              {/* Profile Image & Summary Section */}
              <div className="flex flex-col lg:flex-row items-center lg:items-start gap-10">
                <div className="relative group">
                  <div className="h-40 w-40 rounded-full overflow-hidden border-[6px] border-white shadow-2xl bg-slate-100 ring-2 ring-slate-100 transition-all duration-300 group-hover:ring-blue-100">
                    {profileData.profileImage && !imageError ? (
                      <img
                        src={getImageSrc()}
                        alt="Profile"
                        onLoad={() => {
                            console.log("SUCCESS: Image loaded from:", getImageSrc());
                            setImageError(false);
                        }}
                        onError={() => {
                          console.error("FAILURE: Image load failed for:", getImageSrc());
                          setImageError(true);
                        }}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
                        <User className="h-20 w-20 text-blue-200" />
                      </div>
                    )}
                  </div>
                  {isEditingProfile && (
                    <label className="absolute bottom-2 right-2 h-12 w-12 bg-[#155dfc] rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-all hover:scale-110 shadow-2xl border-[3px] border-white text-white z-10">
                      <Camera className="h-6 w-6" />
                      <input type="file" className="hidden" onChange={handleImageChange} accept="image/*" />
                    </label>
                  )}
                </div>
                
                <div className="flex-1 text-center lg:text-left space-y-4">
                  <div>
                    <h3 className="font-extrabold text-2xl text-slate-900">
                      {profileData.firstName || profileData.lastName ? `${profileData.firstName} ${profileData.lastName}` : "User Profile"}
                    </h3>
                    <p className="text-blue-600 font-semibold flex items-center justify-center lg:justify-start gap-2 mt-1">
                      <span className="bg-blue-50 px-3 py-1 rounded-full text-sm">Pet Owner</span>
                    </p>
                  </div>
                  <p className="text-slate-500 text-lg leading-relaxed max-w-2xl">
                    {isEditingProfile 
                      ? "Choose a high-quality photo to help our veterinarians recognize you during appointments. Supported formats: JPG, PNG, GIF." 
                      : "Your profile details are kept secure and only shared with verified clinic staff for medical purposes."}
                  </p>
                  {imageError && profileData.profileImage && !isEditingProfile && (
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium border border-amber-100">
                      <Clock className="h-4 w-4" /> 
                      <span>Image path might be broken. Try re-uploading your photo.</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                <div className="space-y-3">
                  <Label htmlFor="firstName" className="text-xs font-black text-slate-500 uppercase tracking-widest">First Name</Label>
                  <Input
                    id="firstName"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                    disabled={!isEditingProfile || isSaving}
                    className="h-14 px-5 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-lg shadow-sm transition-all"
                    placeholder="First Name"
                  />
                </div>
                
                <div className="space-y-3">
                  <Label htmlFor="lastName" className="text-xs font-black text-slate-500 uppercase tracking-widest">Last Name</Label>
                  <Input
                    id="lastName"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                    disabled={!isEditingProfile || isSaving}
                    className="h-14 px-5 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-lg shadow-sm transition-all"
                    placeholder="Last Name"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="email" className="text-xs font-black text-slate-500 uppercase tracking-widest">Email Address</Label>
                  <div className="relative group">
                    <Mail className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                    <Input 
                      id="email" 
                      value={profileData.email} 
                      disabled={true} 
                      className="h-14 pl-14 bg-slate-50 border-slate-200 rounded-xl text-slate-500 cursor-not-allowed text-lg" 
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="phone" className="text-xs font-black text-slate-500 uppercase tracking-widest">Phone Number</Label>
                  <div className="relative group">
                    <Phone className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 transition-colors group-focus-within:text-blue-500" />
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      disabled={!isEditingProfile || isSaving}
                      className="h-14 pl-14 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-lg shadow-sm transition-all"
                      placeholder="+63 XXX XXX XXXX"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="dob" className="text-xs font-black text-slate-500 uppercase tracking-widest">
                    {isEditingProfile ? "Date of Birth" : "Current Age"}
                  </Label>
                  <div className="relative group">
                    <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 transition-colors group-focus-within:text-blue-500" />
                    {isEditingProfile ? (
                      <Input
                        id="dob"
                        type="date"
                        value={profileData.dateOfBirth ? profileData.dateOfBirth.split(' ')[0] : ""}
                        onChange={(e) => setProfileData({ ...profileData, dateOfBirth: e.target.value })}
                        disabled={isSaving}
                        className="h-14 pl-14 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-lg shadow-sm transition-all w-full"
                      />
                    ) : (
                      <div className="h-14 w-full rounded-xl border border-slate-200 bg-slate-50 px-6 py-2 pl-14 text-lg flex items-center text-slate-700 font-semibold">
                        {profileData.dateOfBirth ? calculateAge(profileData.dateOfBirth) : "Not set"}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3 md:col-span-2">
                  <Label htmlFor="address" className="text-xs font-black text-slate-500 uppercase tracking-widest">Residential Address</Label>
                  <div className="relative group">
                    <MapPin className="absolute left-5 top-4 h-5 w-5 text-slate-400 transition-colors group-focus-within:text-blue-500" />
                    <Input
                      id="address"
                      value={profileData.address}
                      onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                      disabled={!isEditingProfile || isSaving}
                      className="h-14 pl-14 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-lg shadow-sm transition-all"
                      placeholder="Street Number, Barangay, City, Province"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {isEditingProfile && (
                <div className="pt-10 flex flex-col sm:flex-row justify-end gap-4 border-t border-slate-100">
                  <Button
                    variant="outline"
                    disabled={isSaving}
                    onClick={() => {
                      setIsEditingProfile(false);
                      setImageFile(null);
                      setImageError(false);
                      setProfileData(normalizeUser(contextUser || JSON.parse(localStorage.getItem("currentUser") || "{}")));
                    }}
                    className="px-10 h-14 text-lg rounded-xl font-bold border-slate-200 hover:bg-slate-50"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSaveProfile} 
                    disabled={isSaving} 
                    className="px-14 h-14 bg-[#155dfc] hover:bg-blue-700 shadow-xl rounded-xl text-lg font-bold transition-all transform hover:scale-[1.02]"
                  >
                    {isSaving ? (
                        <>
                            <Loader2 className="animate-spin h-6 w-6 mr-3" />
                            Saving...
                        </>
                    ) : "Save Changes"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="outline-none animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Card className="border-slate-200 shadow-xl rounded-2xl overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/80 border-b border-slate-100 px-8 py-6">
              <CardTitle className="text-2xl font-bold text-slate-800">Account Security</CardTitle>
            </CardHeader>
            <CardContent className="p-16 flex flex-col items-center justify-center py-24 text-center">
              <div className="h-24 w-24 bg-blue-50 rounded-full flex items-center justify-center mb-8 border-4 border-white shadow-xl">
                <Clock className="h-12 w-12 text-[#155dfc]" />
              </div>
              <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Security Features Coming Soon</h3>
              <p className="text-slate-500 mt-4 max-w-lg text-xl leading-relaxed">
                We're developing advanced security protocols, including two-factor authentication and password encryption tools, to keep your data even safer.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
