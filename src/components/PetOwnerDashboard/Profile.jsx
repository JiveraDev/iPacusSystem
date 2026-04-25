import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { toast } from "./toast";
import { User, Upload, Lock } from "lucide-react";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    address: "",
    city: "",
    postalCode: "",
    profileImage: "",
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    if (currentUser) {
      setUser(currentUser);
      setProfileData({
        firstName: currentUser.firstName || "",
        lastName: currentUser.lastName || "",
        email: currentUser.email || "",
        phone: currentUser.phone || "",
        dateOfBirth: currentUser.dateOfBirth || "",
        address: currentUser.address || "",
        city: currentUser.city || "",
        postalCode: currentUser.postalCode || "",
        profileImage: currentUser.profileImage || "",
      });
    }
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileData({ ...profileData, profileImage: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = () => {
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const userIndex = users.findIndex((u) => u.id === user.id);

    if (userIndex !== -1) {
      users[userIndex] = {
        ...users[userIndex],
        ...profileData,
      };
      localStorage.setItem("users", JSON.stringify(users));
      localStorage.setItem("currentUser", JSON.stringify(users[userIndex]));
      setUser(users[userIndex]);
      setIsEditingProfile(false);
      toast.success("Profile updated successfully!");
    }
  };

  const handleChangePassword = () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (passwordData.currentPassword !== user.password) {
      toast.error("Current password is incorrect");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const userIndex = users.findIndex((u) => u.id === user.id);

    if (userIndex !== -1) {
      users[userIndex].password = passwordData.newPassword;
      localStorage.setItem("users", JSON.stringify(users));
      localStorage.setItem("currentUser", JSON.stringify(users[userIndex]));
      setUser(users[userIndex]);
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast.success("Password changed successfully!");
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6 lg:space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Profile Settings</h1>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="profile">Profile Details</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* Profile Details Tab */}
        <TabsContent value="profile" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Profile Image */}
              <div className="mb-6">
                <Label className="mb-3 block">Profile Picture</Label>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {profileData.profileImage ? (
                    <img
                      src={profileData.profileImage}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover border-4 border-blue-100"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                      <User className="h-12 w-12 text-white" />
                    </div>
                  )}
                  {isEditingProfile && (
                    <div>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="max-w-xs"
                      />
                      <p className="text-sm text-gray-600 mt-1">Upload a new profile picture</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Personal Details */}
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={profileData.firstName}
                      onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                      disabled={!isEditingProfile}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={profileData.lastName}
                      onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                      disabled={!isEditingProfile}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      disabled
                      className="bg-gray-100"
                    />
                    <p className="text-xs text-gray-600">Email cannot be changed</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      disabled={!isEditingProfile}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={profileData.dateOfBirth}
                    onChange={(e) => setProfileData({ ...profileData, dateOfBirth: e.target.value })}
                    disabled={!isEditingProfile}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={profileData.address}
                    onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                    disabled={!isEditingProfile}
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={profileData.city}
                      onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                      disabled={!isEditingProfile}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      value={profileData.postalCode}
                      onChange={(e) => setProfileData({ ...profileData, postalCode: e.target.value })}
                      disabled={!isEditingProfile}
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  {!isEditingProfile ? (
                    <Button onClick={() => setIsEditingProfile(true)} className="w-full">
                      Edit Profile
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditingProfile(false);
                          setProfileData({
                            firstName: user.firstName || "",
                            lastName: user.lastName || "",
                            email: user.email || "",
                            phone: user.phone || "",
                            dateOfBirth: user.dateOfBirth || "",
                            address: user.address || "",
                            city: user.city || "",
                            postalCode: user.postalCode || "",
                            profileImage: user.profileImage || "",
                          });
                        }}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button onClick={handleSaveProfile} className="flex-1">
                        Save Changes
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-blue-600" />
                Change Password
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    placeholder="Enter your current password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Enter new password (at least 6 characters)"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Re-enter new password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  />
                </div>

                <Button onClick={handleChangePassword} className="w-full">
                  Change Password
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-orange-900">Account Security</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-orange-800">
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Use a strong password with at least 6 characters</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Never share your password with anyone</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Change your password regularly for better security</span>
                </li>
                <li className="flex gap-2">
                  <span>•</span>
                  <span>Contact support if you notice any suspicious activity</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

