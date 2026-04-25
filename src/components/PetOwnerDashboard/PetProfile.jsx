import { useEffect, useState } from "react";
import { useNavigate, useParams } from "./dashboardRouter";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { ArrowLeft, FileText, PawPrint, Syringe, AlertCircle, Printer } from "lucide-react";

export default function PetProfile() {
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

  const handlePrint = () => {
    // Get medical records
    const organizedRecords = pet.medicalRecords?.organized || [];
    const unorganizedRecords = pet.medicalRecords?.unorganized || [];

    // Create print window content
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${pet.name} - Complete Medical Records</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              max-width: 1000px;
              margin: 0 auto;
            }
            h1 {
              color: #1e40af;
              border-bottom: 3px solid #1e40af;
              padding-bottom: 10px;
            }
            h2 {
              color: #2563eb;
              margin-top: 30px;
              border-bottom: 2px solid #93c5fd;
              padding-bottom: 5px;
            }
            h3 {
              color: #374151;
              margin-top: 20px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 30px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
              margin: 20px 0;
            }
            .info-item {
              padding: 10px;
              background: #f3f4f6;
              border-radius: 5px;
            }
            .info-label {
              font-size: 12px;
              color: #6b7280;
              margin-bottom: 5px;
            }
            .info-value {
              font-weight: bold;
              color: #111827;
            }
            .badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 12px;
              font-weight: 600;
            }
            .badge-healthy {
              background: #d1fae5;
              color: #065f46;
            }
            .badge-treatment {
              background: #fef3c7;
              color: #92400e;
            }
            .badge-critical {
              background: #fee2e2;
              color: #991b1b;
            }
            .section {
              margin: 30px 0;
              page-break-inside: avoid;
            }
            .record-card {
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 15px;
              margin: 15px 0;
              page-break-inside: avoid;
            }
            .allergy-card {
              background: #fff7ed;
              border: 1px solid #fed7aa;
              border-radius: 8px;
              padding: 15px;
              margin: 10px 0;
            }
            .vaccination-card {
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 15px;
              margin: 10px 0;
              display: flex;
              justify-content: space-between;
            }
            .microchip {
              background: #dbeafe;
              padding: 10px;
              border-radius: 5px;
              font-family: monospace;
              margin: 10px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
            }
            th, td {
              padding: 10px;
              text-align: left;
              border-bottom: 1px solid #e5e7eb;
            }
            th {
              background: #f3f4f6;
              font-weight: 600;
            }
            .print-date {
              color: #6b7280;
              font-size: 12px;
              margin-top: 20px;
            }
            @media print {
              body {
                padding: 0;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>${pet.name}'s Complete Medical Records</h1>
              <p style="color: #6b7280; font-size: 14px;">${pet.species} • ${pet.breed}</p>
            </div>
            <div>
              <span class="badge ${pet.status === 'Healthy' ? 'badge-healthy' : pet.status === 'Under Treatment' ? 'badge-treatment' : 'badge-critical'}">
                ${pet.status}
              </span>
            </div>
          </div>

          <h2>Basic Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Species</div>
              <div class="info-value">${pet.species}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Breed</div>
              <div class="info-value">${pet.breed}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Age</div>
              <div class="info-value">${pet.age ? `${pet.age} years` : 'Not specified'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Gender</div>
              <div class="info-value">${pet.gender || 'Not specified'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Weight</div>
              <div class="info-value">${pet.weight ? `${pet.weight} kg` : 'Not specified'}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Color/Markings</div>
              <div class="info-value">${pet.color || 'Not specified'}</div>
            </div>
          </div>

          ${pet.microchipId ? `
            <div class="microchip">
              <div class="info-label">Microchip ID</div>
              <strong>${pet.microchipId}</strong>
            </div>
          ` : ''}

          ${pet.vaccinations && pet.vaccinations.length > 0 ? `
            <h2>Vaccination Records</h2>
            ${pet.vaccinations.map((vax) => `
              <div class="vaccination-card">
                <div>
                  <strong>${vax.name}</strong><br>
                  <span style="color: #6b7280; font-size: 14px;">Last given: ${new Date(vax.date).toLocaleDateString()}</span>
                </div>
                <div style="text-align: right;">
                  <span class="badge badge-healthy">${vax.status === 'completed' ? 'Completed' : 'Pending'}</span><br>
                  <span style="color: #6b7280; font-size: 14px;">Next due: ${new Date(vax.nextDue).toLocaleDateString()}</span>
                </div>
              </div>
            `).join('')}
          ` : ''}

          ${pet.allergies && pet.allergies.length > 0 ? `
            <h2>Known Allergies</h2>
            ${pet.allergies.map((allergy) => `
              <div class="allergy-card">
                <h3 style="margin-top: 0; color: #ea580c;">${allergy.allergen}</h3>
                <p><strong>Severity:</strong> ${allergy.severity}</p>
                <p><strong>Symptoms:</strong> ${allergy.symptoms}</p>
                ${allergy.diagnosedDate ? `
                  <p style="font-size: 12px; color: #ea580c;">
                    Diagnosed: ${new Date(allergy.diagnosedDate).toLocaleDateString()} • ${allergy.veterinarian}
                  </p>
                ` : ''}
              </div>
            `).join('')}
          ` : ''}

          ${organizedRecords.length > 0 ? `
            <h2>Electronic Medical Records - Organized by Diagnosis</h2>
            ${organizedRecords.map((record) => `
              <div class="record-card">
                <h3>${record.diagnosisGroup}</h3>
                <p style="color: #6b7280; font-size: 14px;">
                  ${record.visitCount} visit(s) • 
                  ${new Date(record.firstVisit).toLocaleDateString()} - ${new Date(record.lastVisit).toLocaleDateString()}
                </p>

                ${record.visits && record.visits.length > 0 ? `
                  ${record.visits.map((visit, idx) => `
                    <div style="margin: 15px 0; padding: 15px; background: #f9fafb; border-left: 4px solid #3b82f6;">
                      <h4 style="margin-top: 0;">Visit ${idx + 1} - ${new Date(visit.date).toLocaleDateString()}</h4>
                      <p><strong>Veterinarian:</strong> ${visit.veterinarian}</p>
                      
                      ${visit.chiefComplaint ? `<p><strong>Chief Complaint:</strong> ${visit.chiefComplaint}</p>` : ''}
                      
                      ${visit.vitalSigns ? `
                        <p><strong>Vital Signs:</strong></p>
                        <ul>
                          ${visit.vitalSigns.temperature ? `<li>Temperature: ${visit.vitalSigns.temperature}</li>` : ''}
                          ${visit.vitalSigns.heartRate ? `<li>Heart Rate: ${visit.vitalSigns.heartRate}</li>` : ''}
                          ${visit.vitalSigns.respiratoryRate ? `<li>Respiratory Rate: ${visit.vitalSigns.respiratoryRate}</li>` : ''}
                          ${visit.vitalSigns.weight ? `<li>Weight: ${visit.vitalSigns.weight}</li>` : ''}
                        </ul>
                      ` : ''}

                      ${visit.physicalExam ? `<p><strong>Physical Examination:</strong> ${visit.physicalExam}</p>` : ''}
                      ${visit.diagnosis ? `<p><strong>Diagnosis:</strong> ${visit.diagnosis}</p>` : ''}
                      ${visit.treatment ? `<p><strong>Treatment Plan:</strong> ${visit.treatment}</p>` : ''}
                      ${visit.notes ? `<p><strong>Additional Notes:</strong> ${visit.notes}</p>` : ''}
                      
                      ${visit.medicalImages && visit.medicalImages.length > 0 ? `
                        <p><strong>Medical Imaging:</strong></p>
                        <ul>
                          ${visit.medicalImages.map((img) => `
                            <li>${img.type} - ${img.description} (${new Date(img.date).toLocaleDateString()})</li>
                          `).join('')}
                        </ul>
                      ` : ''}
                    </div>
                  `).join('')}
                ` : ''}
              </div>
            `).join('')}
          ` : ''}

          ${unorganizedRecords.length > 0 ? `
            <h2>Service History - Unorganized Records</h2>
            ${unorganizedRecords.map((record) => `
              <div class="record-card">
                <h3>${record.service}</h3>
                <p style="color: #6b7280;">
                  ${new Date(record.date).toLocaleDateString()} • ${record.veterinarian}
                </p>
                ${record.notes ? `<p>${record.notes}</p>` : ''}
                ${record.cost ? `<p><strong>Cost:</strong> ₱${record.cost.toLocaleString()}</p>` : ''}
              </div>
            `).join('')}
          ` : ''}

          <div class="print-date">
            <p>Printed on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
            <p>Veterinary Focus Clinic - Electronic Medical Records System</p>
          </div>
        </body>
      </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  if (!pet) {
    return (
      <div className="space-y-8">
        <Button variant="ghost" onClick={() => navigate("/dashboard/my-pets")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to My Pets
        </Button>
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <PawPrint className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">Pet Not Found</h3>
            <p className="text-gray-600 mb-4">
              We couldn't find the pet you're looking for.
            </p>
            <Button onClick={() => navigate("/dashboard/my-pets")}>
              Back to My Pets
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" onClick={() => navigate("/dashboard/my-pets")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      {/* Request Update Record Button */}
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-green-200 rounded-full flex items-center justify-center">
                <FileText className="h-6 w-6 text-green-700" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Request Update Record</h3>
                <p className="text-sm text-gray-700">Pay veterinarian convenience fee to edit/update pet records</p>
              </div>
            </div>
            <Button 
              onClick={() => navigate(`/dashboard/my-pets/${petId}/request-update`)}
              size="lg"
              className="bg-green-600 hover:bg-green-700"
            >
              Request Update
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pet Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {pet.profileImage ? (
              <img
                src={pet.profileImage}
                alt={pet.name}
                className="w-32 h-32 rounded-full object-cover border-4 border-blue-100"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                <PawPrint className="h-16 w-16 text-white" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{pet.name}</h1>
                  <p className="text-xl text-gray-600">{pet.species} • {pet.breed}</p>
                </div>
                <Badge className={
                  pet.status === 'Healthy' 
                    ? 'bg-green-100 text-green-700' 
                    : pet.status === 'Under Treatment'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }>
                  {pet.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Age</p>
                  <p className="font-semibold">{pet.age || 'N/A'} years</p>
                </div>
                <div>
                  <p className="text-gray-600">Gender</p>
                  <p className="font-semibold">{pet.gender || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-600">Weight</p>
                  <p className="font-semibold">{pet.weight ? `${pet.weight} kg` : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-600">Color</p>
                  <p className="font-semibold">{pet.color || 'N/A'}</p>
                </div>
              </div>
              {pet.microchipId && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Microchip ID</p>
                  <p className="font-mono font-semibold">{pet.microchipId}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vaccinations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Syringe className="h-5 w-5 text-blue-600" />
            Vaccination Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pet.vaccinations && pet.vaccinations.length > 0 ? (
              pet.vaccinations.map((vax, index) => (
                <div key={index} className="p-4 border rounded-lg bg-white hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-lg text-gray-900">{vax.name}</h4>
                        <Badge className={vax.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}>
                          {vax.status === 'completed' ? 'Completed' : 'Pending'}
                        </Badge>
                      </div>
                      {vax.contents && (
                        <p className="text-sm text-gray-600 mb-2">
                          <span className="font-medium">Contains:</span> {vax.contents}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-100">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Administered By</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {vax.applicator || vax.veterinarian || 'Not recorded'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Date Administered</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {new Date(vax.date).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Next Due Date</p>
                      <p className="text-sm font-semibold text-blue-600">
                        {new Date(vax.nextDue).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                    {vax.batchNumber && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Batch Number</p>
                        <p className="text-sm font-mono text-gray-700">{vax.batchNumber}</p>
                      </div>
                    )}
                  </div>
                  
                  {vax.notes && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500 mb-1">Notes</p>
                      <p className="text-sm text-gray-700">{vax.notes}</p>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-gray-600 text-center py-4">No vaccination records yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Allergies */}
      {pet.allergies && pet.allergies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              Known Allergies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pet.allergies.map((allergy, index) => (
                <div key={index} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-orange-900">{allergy.allergen}</h4>
                      <p className="text-sm text-orange-700 mt-1">
                        <span className="font-medium">Severity:</span> {allergy.severity}
                      </p>
                      <p className="text-sm text-orange-700 mt-1">
                        <span className="font-medium">Symptoms:</span> {allergy.symptoms}
                      </p>
                      {allergy.diagnosedDate && (
                        <p className="text-xs text-orange-600 mt-2">
                          Diagnosed: {new Date(allergy.diagnosedDate).toLocaleDateString()} • {allergy.veterinarian}
                        </p>
                      )}
                    </div>
                    <Badge className="bg-orange-100 text-orange-700 border-orange-300">
                      {allergy.severity}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Personal Details */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Species</p>
              <p className="font-semibold">{pet.species}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Breed</p>
              <p className="font-semibold">{pet.breed}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Age</p>
              <p className="font-semibold">{pet.age ? `${pet.age} years` : 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Gender</p>
              <p className="font-semibold">{pet.gender || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Weight</p>
              <p className="font-semibold">{pet.weight ? `${pet.weight} kg` : 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Color/Markings</p>
              <p className="font-semibold">{pet.color || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Microchip ID</p>
              <p className="font-semibold font-mono">{pet.microchipId || 'Not microchipped'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Status</p>
              <Badge className={
                pet.status === 'Healthy' 
                  ? 'bg-green-100 text-green-700' 
                  : pet.status === 'Under Treatment'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
              }>
                {pet.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Print Records Button */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-blue-200 rounded-full flex items-center justify-center">
                <Printer className="h-6 w-6 text-blue-700" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">View Medical Records</h3>
                <p className="text-sm text-gray-700">View complete medical history and diagnosis records</p>
              </div>
            </div>
            <Button 
              onClick={handlePrint}
              size="lg"
            >
              View Records
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

