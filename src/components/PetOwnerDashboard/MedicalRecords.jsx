import { useEffect, useState } from "react";
import { useNavigate, useParams } from "./dashboardRouter";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs";
import { Badge } from "../../ui/badge";
import { ArrowLeft, FileText, Calendar, Pill, Activity } from "lucide-react";

export default function MedicalRecords() {
  const navigate = useNavigate();
  const { petId } = useParams();
  const [pet, setPet] = useState(null);

  useEffect(() => {
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    const user = users.find((u) => u.id === currentUser.id);

    if (user && user.pets) {
      const foundPet = user.pets.find((p) => p.id === petId);
      if (foundPet) {
        setPet(foundPet);
      }
    }
  }, [petId]);

  if (!pet) {
    return (
      <div className="space-y-8">
        <Button variant="ghost" onClick={() => navigate("/dashboard/my-pets")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Pet Not Found</h3>
            <Button onClick={() => navigate("/dashboard/my-pets")}>
              Back to My Pets
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get organized and unorganized records
  const organizedRecords = pet.medicalRecords?.organized || [];
  const unorganizedRecords = pet.medicalRecords?.unorganized || [];

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Back Button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(`/dashboard/my-pets/${petId}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to {pet.name}'s Profile
        </Button>
      </div>

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Electronic Medical Records</h1>
        <p className="text-gray-600">{pet.name} - {pet.species} • {pet.breed}</p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="organized" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="organized">Organized Records</TabsTrigger>
          <TabsTrigger value="unorganized">Service History</TabsTrigger>
        </TabsList>

        {/* Organized Records Tab */}
        <TabsContent value="organized" className="space-y-6 mt-6">
          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                Diagnosis & Treatment Groups
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Records grouped by diagnosis and follow-up visits, showing complete treatment history.
              </p>
            </CardContent>
          </Card>

          {/* Organized Records List */}
          {organizedRecords.length > 0 ? (
            <div className="space-y-6">
              {organizedRecords.map((record) => (
                <Card key={record.id} className="border-2">
                  <CardHeader className="bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl mb-2">{record.diagnosisGroup}</CardTitle>
                        <p className="text-sm text-gray-600">
                          {new Date(record.startDate).toLocaleDateString()} - {new Date(record.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge className={
                        record.status === 'Completed' 
                          ? 'bg-green-100 text-green-700' 
                          : record.status === 'Ongoing'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }>
                        {record.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {/* Final Diagnosis */}
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-semibold text-blue-900 mb-2">Final Diagnosis</h4>
                      <p className="text-blue-800">{record.finalDiagnosis}</p>
                      {record.finalDiagnosisNote && (
                        <ul className="mt-2 ml-4 list-disc">
                          <li className="text-blue-700">{record.finalDiagnosisNote}</li>
                        </ul>
                      )}
                    </div>

                    {/* Treatment Timeline */}
                    <h4 className="font-semibold mb-4">Treatment Timeline ({record.visits?.length || 0} visits)</h4>
                    <div className="space-y-4">
                      {record.visits && record.visits.length > 0 ? (
                        record.visits.map((visit, index) => (
                        <div key={index} className="border-l-4 border-blue-600 pl-4 py-2">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h5 className="font-semibold">{visit.type}</h5>
                              <p className="text-sm text-gray-600">
                                {new Date(visit.date).toLocaleDateString()} • {visit.veterinarian}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">Symptoms:</span>
                              <span className="ml-2 text-gray-600">{visit.symptoms}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Diagnosis:</span>
                              <span className="ml-2 text-gray-600">{visit.diagnosis}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Treatment:</span>
                              <span className="ml-2 text-gray-600">{visit.treatment}</span>
                            </div>
                            {visit.medications && visit.medications.length > 0 && (
                              <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                <span className="font-medium text-blue-900 flex items-center gap-2 mb-2">
                                  <Pill className="h-4 w-4" />
                                  Medications Prescribed:
                                </span>
                                <div className="space-y-2">
                                  {visit.medications.map((med, medIdx) => (
                                    <div key={medIdx} className="text-sm text-blue-800 pl-4">
                                      <div className="font-semibold">{med.name}</div>
                                      <div className="text-blue-700">
                                        {med.dosage} • {med.frequency} • {med.duration}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {visit.notes && (
                              <div className="mt-2 p-2 bg-gray-50 rounded">
                                <span className="font-medium text-gray-700">Notes:</span>
                                <span className="ml-2 text-gray-600">{visit.notes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                      ) : (
                        <p className="text-gray-500 text-center py-4">No visits recorded</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No Organized Records</h3>
                <p className="text-gray-600">
                  No grouped diagnosis records available yet.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Service History Tab */}
        <TabsContent value="unorganized" className="space-y-6 mt-6">
          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                All Service History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Complete history of all services and visits, sorted by date.
              </p>
            </CardContent>
          </Card>

          {/* Service History List */}
          {unorganizedRecords.length > 0 ? (
            <div className="space-y-4">
              {unorganizedRecords
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((record) => (
                  <Card key={record.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3 mb-2">
                        <Calendar className="h-5 w-5 text-blue-600" />
                        <span className="font-semibold text-lg">
                          {new Date(record.date).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">{record.service}</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Veterinarian: {record.veterinarian}
                      </p>

                      {/* Chief Complaint */}
                      <div className="mb-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Chief Complaint</h4>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-gray-700">{record.description}</p>
                        </div>
                      </div>

                      {/* Vital Signs */}
                      <div className="mb-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Vital Signs</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-600 mb-1">Temperature (°C)</p>
                            <p className="text-sm font-medium text-gray-900">38.5</p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-600 mb-1">Heart Rate (bpm)</p>
                            <p className="text-sm font-medium text-gray-900">120</p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-600 mb-1">Respiratory Rate</p>
                            <p className="text-sm font-medium text-gray-900">30</p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-600 mb-1">Weight (kg)</p>
                            <p className="text-sm font-medium text-gray-900">12.5</p>
                          </div>
                        </div>
                      </div>

                      {/* Physical Examination Findings */}
                      <div className="mb-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Physical Examination Findings</h4>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700">General appearance: HEENT, cardiovascular, respiratory findings documented</p>
                        </div>
                      </div>

                      {/* Diagnosis */}
                      <div className="mb-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Diagnosis</h4>
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                          <p className="text-sm text-blue-900 font-medium">{record.service}</p>
                        </div>
                      </div>

                      {/* Treatment Plan */}
                      <div className="mb-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Treatment Plan</h4>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-700">Recommended treatments, procedures, and interventions as per diagnosis</p>
                        </div>
                      </div>

                      {/* Lab Results & Images */}
                      <div className="mb-4">
                        <h4 className="font-semibold text-gray-900 mb-2">Lab Results & Images</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="relative rounded-lg overflow-hidden border border-gray-200">
                            <img 
                              src="https://images.unsplash.com/photo-1648025487763-993aa9ee7ba9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx2ZXRlcmluYXJ5JTIweC1yYXklMjBzY2FufGVufDF8fHx8MTc3MjMzMjgwOXww&ixlib=rb-4.1.0&q=80&w=1080" 
                              alt="X-ray scan" 
                              className="w-full h-32 object-cover"
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-2">
                              X-ray Scan
                            </div>
                          </div>
                          <div className="relative rounded-lg overflow-hidden border border-gray-200">
                            <img 
                              src="https://images.unsplash.com/photo-1640161415278-a5ac46f82d04?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkb2clMjBtZWRpY2FsJTIwc2NhbiUyMGltYWdlfGVufDF8fHx8MTc3MjMzMjgxMHww&ixlib=rb-4.1.0&q=80&w=1080" 
                              alt="Medical imaging" 
                              className="w-full h-32 object-cover"
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-2">
                              Lab Results
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Additional Notes */}
                      {record.notes && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                          <h4 className="font-semibold text-blue-900 mb-2">Additional Notes</h4>
                          <p className="text-sm text-gray-700">{record.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No Service History</h3>
                <p className="text-gray-600">
                  No service records available yet.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

