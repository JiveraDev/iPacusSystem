import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { toast } from "../../reusecomponent/toast.jsx";
import { User, Mail, Phone, MapPin, Calendar, Camera, Loader2 } from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function PetOwnerProfile() {
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

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
    if (user) {
      setProfileData({
        firstName: user.firstName || user.first_name || "",
        lastName: user.lastName || user.last_name || "",
        email: user.email || user.mail_Address || "",
        phone: user.phoneNumber || "",
        address: user.address || user.personal_Address || "",
        dateOfBirth: user.dateOfBirth || user.birthdate || "",
        profileImage: user.profileImage || user.setProfilePic_url || "",
      });
      // Reset error state when loading new data
      setImageError(false);
    }
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setProfileData({ ...profileData, profileImage: URL.createObjectURL(file) });
      setImageError(false); // Reset error for new selection
    }
  };

  const handleSaveProfile = async () => {
    const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const userId = user.id || user.user_id;

    if (!userId) {
      toast.error("User session lost. Please log in again.");
      return;
    }

    setIsSaving(true);
    let finalImageUrl = profileData.profileImage;

    try {
      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        
        const uploadRes = await fetch(`${API_BASE_URL}/api/upload`, {
          method: 'POST',
          body: formData
        });

        if (!uploadRes.ok) throw new Error("Failed to upload profile picture");
        const uploadResult = await uploadRes.json();
        finalImageUrl = uploadResult.url;
      }

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

      if (!response.ok) throw new Error("Failed to update profile in database");

      const updatedUser = {
        ...user,
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        phoneNumber: profileData.phone,
        address: profileData.address,
        dateOfBirth: profileData.dateOfBirth,
        profileImage: finalImageUrl,
      };
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));

      setIsEditingProfile(false);
      setImageFile(null);
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Save error:", error);
      toast.error(error.message || "Error saving profile");
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to get the correct image source
  const getImageSrc = () => {
    if (!profileData.profileImage) return null;
    if (profileData.profileImage.startsWith('blob:') || profileData.profileImage.startsWith('data:')) {
      return profileData.profileImage;
    }
    return `${API_BASE_URL}${profileData.profileImage}`;
  };

  return (
    <div className="space-y-6 lg:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Profile Settings</h1>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="profile">Profile Details</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Profile Image */}
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative">
                  {profileData.profileImage && !imageError ? (
                    <img
                      src={getImageSrc()}
                      alt="Profile"
                      onError={() => setImageError(true)}
                      className="h-24 w-24 rounded-full object-cover border-4 border-blue-50 bg-slate-100"
                    />
                  ) : (
                    <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center border-4 border-blue-50">
                      <User className="h-12 w-12 text-blue-600" />
                    </div>
                  )}
                  {isEditingProfile && (
                    <label className="absolute bottom-0 right-0 h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-blue-700 transition-colors border-2 border-white">
                      <Camera className="h-4 w-4 text-white" />
                      <input type="file" className="hidden" onChange={handleImageChange} accept="image/*" />
                    </label>
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Profile Picture</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {isEditingProfile ? "Click the camera icon to change" : "Upload a new profile picture"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="firstName"
                      value={profileData.firstName}
                      onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                      className="pl-10"
                      disabled={!isEditingProfile || isSaving}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="lastName"
                      value={profileData.lastName}
                      onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                      className="pl-10"
                      disabled={!isEditingProfile || isSaving}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input id="email" value={profileData.email} className="pl-10" disabled={true} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      className="pl-10"
                      disabled={!isEditingProfile || isSaving}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="dob"
                      type="date"
                      value={profileData.dateOfBirth}
                      onChange={(e) => setProfileData({ ...profileData, dateOfBirth: e.target.value })}
                      className="pl-10"
                      disabled={!isEditingProfile || isSaving}
                    />
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Residential Address</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="address"
                      value={profileData.address}
                      onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                      className="pl-10"
                      disabled={!isEditingProfile || isSaving}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                {!isEditingProfile ? (
                  <Button onClick={() => setIsEditingProfile(true)} className="w-full sm:w-auto px-8">
                    Edit Profile
                  </Button>
                ) : (
                  <div className="flex gap-4 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      disabled={isSaving}
                      onClick={() => {
                        setIsEditingProfile(false);
                        setImageFile(null);
                        setImageError(false);
                        const user = JSON.parse(localStorage.getItem("currentUser") || "{}");
                        setProfileData({
                          firstName: user.firstName || user.first_name || "",
                          lastName: user.lastName || user.last_name || "",
                          email: user.email || user.mail_Address || "",
                          phone: user.phoneNumber || "",
                          address: user.address || user.personal_Address || "",
                          dateOfBirth: user.dateOfBirth || user.birthdate || "",
                          profileImage: user.profileImage || user.setProfilePic_url || "",
                        });
                      }}
                      className="flex-1 sm:flex-none"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleSaveProfile} 
                      disabled={isSaving}
                      className="flex-1 sm:flex-none px-8"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : "Save Changes"}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Account Security</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-6">Security settings will be configurable in a future update.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
