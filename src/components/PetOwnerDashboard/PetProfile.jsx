import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "../dashboardRouter.jsx";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import { Input } from "../../ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { ArrowLeft, FileText, PawPrint, Syringe, AlertCircle, ClipboardPenLine, HeartPulse, Loader2, Copy, Check, Camera, ClipboardList, CalendarClock, Eye, ShieldCheck, UserPlus, Pencil, Save, X, Download, RotateCw } from "lucide-react";
import navigationLogo from "../../assets/circular_logo.png";
import { toast } from "../../reusecomponent/toast.jsx";
import { resolveImageUrl } from "../../lib/image";
import { calculateAge, formatDisplayDate, formatDisplayDateTime, formatDisplayTime } from "../../lib/date";
import { formatPhpCurrency } from "../../lib/currency";
import { formatQueueReference } from "../../lib/referenceNumbers";
import { getServiceDisplayName } from "../../lib/serviceLabels";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import {
  canReconstructConsentDocument,
  consentDocumentPath,
  downloadConsentDocument,
  normalizeConsentForms,
  openProtectedDocument,
  useConsentDocumentSource,
} from "../../hooks/useConsentDocumentSource";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../../ui/sheet";
import { PhotoViewer } from "../../ui/photo-viewer";
import ProtectedImage from "../shared/ProtectedImage.jsx";
import EditPetInformationDialog from "../shared/EditPetInformationDialog.jsx";
import { canEditPetInformation } from "../../lib/petInformation";

import { findPetService } from "../../services/findPet";
import { updateBookingStatus } from "../../services/bookingService";
import { fetchPetBookings, fetchPetQueues, updatePetDetails } from "../../services/petService";
import { uploadFormData } from "../../services/uploadService";
import { fetchRecordUpdateRequests } from "../../services/recordUpdateRequestService";

function uploadFileName(path) {
  const cleanPath = String(path || "").split("?")[0].replace(/\\/g, "/");
  return cleanPath.split("/").filter(Boolean).pop() || "Upload";
}

function isImageUploadPath(path) {
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(String(path || "").split("?")[0]);
}

async function downloadBookingUpload(path) {
  try {
    await downloadConsentDocument(path, uploadFileName(path));
  } catch (error) {
    toast.error(error.message || "Could not download the booking file.");
  }
}

async function viewBookingUpload(path) {
  try {
    await openProtectedDocument(path);
  } catch (error) {
    toast.error(error.message || "Could not open the booking file.");
  }
}

const DIRECTORY_ROLES = ["Admin", "Super Admin", "Veterinarian"];
const BOOKING_PAGE_SIZE = 5;

function isPetOwnerRole(role) {
  return ["pet_owner", "pet owner"].includes(String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_"));
}

function isTemporaryOwnerManagerRole(role) {
  return ["admin", "super_admin", "superadmin"].includes(String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_"));
}

export default function PetProfile() {
  const navigate = useNavigate();
  const { petId } = useParams();
  const [pet, setPet] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  const [queueRecords, setQueueRecords] = useState([]);
  const [bookingRecords, setBookingRecords] = useState([]);
  const [bookingPage, setBookingPage] = useState({ petId: "", limit: BOOKING_PAGE_SIZE });
  const [confirmAction, setConfirmAction] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [consentViewer, setConsentViewer] = useState(null);
  const [isEditingTempOwner, setIsEditingTempOwner] = useState(false);
  const [isSavingTempOwner, setIsSavingTempOwner] = useState(false);
  const [tempOwnerDraft, setTempOwnerDraft] = useState("");
  const [activeRecordUpdateRequest, setActiveRecordUpdateRequest] = useState(null);
  const [isPetInformationEditorOpen, setIsPetInformationEditorOpen] = useState(false);
  const [isIdentityCardFlipped, setIsIdentityCardFlipped] = useState(false);
  const [isConsentPanelOpen, setIsConsentPanelOpen] = useState(false);
  const [isBookingsPanelOpen, setIsBookingsPanelOpen] = useState(false);

  const backTargetLabel = useMemo(() => {
    try {
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      return DIRECTORY_ROLES.includes(currentUser.role || "") ? "Pet Directory" : "My Pets";
    } catch {
      return "My Pets";
    }
  }, []);
  const canRequestRecordUpdate = useMemo(() => {
    try {
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      return isPetOwnerRole(currentUser.role);
    } catch {
      return false;
    }
  }, []);
  const canViewPetOwnerActivity = useMemo(() => {
    try {
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      return isPetOwnerRole(currentUser.role);
    } catch {
      return false;
    }
  }, []);
  const canManageTemporaryOwner = useMemo(() => {
    try {
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      return isTemporaryOwnerManagerRole(currentUser.role);
    } catch {
      return false;
    }
  }, []);
  const canEditBasicPetInformation = useMemo(() => {
    try {
      return canEditPetInformation(JSON.parse(localStorage.getItem("currentUser") || "{}").role);
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (!canRequestRecordUpdate || !petId) return undefined;

    fetchRecordUpdateRequests({
      petId,
      status: "pending_admin_review,approved,assigned,in_progress",
    })
      .then((response) => {
        if (isMounted) setActiveRecordUpdateRequest(response.requests?.[0] || null);
      })
      .catch(() => {
        if (isMounted) setActiveRecordUpdateRequest(null);
      });

    return () => { isMounted = false; };
  }, [canRequestRecordUpdate, petId]);

  useEffect(() => {
    async function fetchPet() {
      try {
        const data = await findPetService(petId);
        // data is now formatted correctly by the backend
        setPet(data);
        setTempOwnerDraft(data.tempOwnerName || "");
        setIsEditingTempOwner(false);
      } catch (error) {
        console.error("Error fetching pet:", error);
        toast.error("Could not load pet profile");
      } finally {
        setIsLoading(false);
      }
    }

    if (petId) {
      fetchPet();
    }
  }, [petId]);

  const fetchPetActivity = async ({ isAutoRefresh = false } = {}) => {
    if (!pet?.db_id) return;

    if (!isAutoRefresh) {
      setIsActivityLoading(true);
    }
    try {
      const [queuesResult, bookingsResult] = await Promise.allSettled([
        fetchPetQueues(pet.db_id),
        fetchPetBookings(pet.db_id)
      ]);

      const queuesData = queuesResult.status === "fulfilled" ? queuesResult.value : [];
      const bookingsData = bookingsResult.status === "fulfilled" ? bookingsResult.value : [];

      setQueueRecords(Array.isArray(queuesData) ? queuesData : []);
      setBookingRecords(Array.isArray(bookingsData) ? bookingsData : []);
    } catch (error) {
      console.error("Error fetching pet activity:", error);
      if (!isAutoRefresh) {
        toast.error("Could not load queue and booking activity");
      }
    } finally {
      setIsActivityLoading(false);
    }
  };

  useAutoRefresh(fetchPetActivity, {
    enabled: Boolean(pet?.db_id),
    refreshKey: pet?.db_id
  });

  const copyToClipboard = () => {
    if (pet?.id) {
      // Fallback copy method for reliability
      const textArea = document.createElement('textarea');
      textArea.value = pet.id;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        toast.success("Pet ID copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Copy failed', err);
      }
      document.body.removeChild(textArea);
    }
  };

  const handlePrint = () => {
    navigate(`/dashboard/my-pets/${petId}/medical-records`);
  };

  const handleSaveTemporaryOwner = async () => {
    if (!pet?.db_id) return;

    const nextTempOwnerName = tempOwnerDraft.trim();
    setIsSavingTempOwner(true);
    try {
      await updatePetDetails(pet.db_id, { tempOwner: nextTempOwnerName || null });
      setPet((current) => current ? {
        ...current,
        tempOwnerName: nextTempOwnerName || null,
        hasOwnership: false,
        ownerUserId: null
      } : current);
      setTempOwnerDraft(nextTempOwnerName);
      setIsEditingTempOwner(false);
      toast.success(nextTempOwnerName ? "Owner name updated." : "Owner name cleared.");
    } catch (error) {
      toast.error(error.message || "Could not update owner name.");
    } finally {
      setIsSavingTempOwner(false);
    }
  };

  const handlePetPhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);
    formData.append('type', 'pet');

    try {
      const result = await uploadFormData(formData);
      await updatePetDetails(pet.db_id, { setpetImage_url: result.relative_url });
      setPet((current) => ({ ...current, profileImage: result.relative_url }));
      toast.success("Profile picture updated!");
    } catch (error) {
      console.error(error);
      toast.error("Upload failed.");
    } finally {
      event.target.value = '';
    }
  };

  const formatDateTime = (dateValue, timeValue) => {
    return formatDisplayDateTime(dateValue, timeValue);
  };

  const getBoardingStayLabel = (type) => {
    return type === "hotel" ? "Pet Hotel Boarding" : "Confinement Boarding";
  };

  const getQueueStatusBadge = (status) => {
    const variants = {
      "waiting": "bg-amber-50 text-amber-700 border-amber-200",
      "in-progress": "bg-blue-50 text-blue-700 border-blue-200",
      "completed": "bg-green-50 text-green-700 border-green-200",
      "done": "bg-green-50 text-green-700 border-green-200",
      "cancelled": "bg-red-50 text-red-700 border-red-200"
    };
    const labels = {
      "waiting": "Pending",
      "in-progress": "Approved",
      "completed": "Done",
      "done": "Done",
      "cancelled": "Cancelled"
    };

    return <Badge className={`${variants[status] || variants.waiting} border`}>{labels[status] || "Pending"}</Badge>;
  };

  const getBookingStatusBadge = (status) => {
    const variants = {
      "pending": "bg-amber-50 text-amber-700 border-amber-200",
      "confirmed": "bg-blue-50 text-blue-700 border-blue-200",
      "completed": "bg-green-50 text-green-700 border-green-200",
      "cancelled": "bg-red-50 text-red-700 border-red-200"
    };
    const labels = {
      "pending": "Pending",
      "confirmed": "Approved",
      "completed": "Done",
      "cancelled": "Cancelled"
    };

    return <Badge className={`${variants[status] || variants.pending} border`}>{labels[status] || "Pending"}</Badge>;
  };

  const shouldShowQueueRecord = (item) => {
    if (item.status === "completed" || item.status === "done") return false;
    return true;
  };

  const visibleQueueRecords = queueRecords.filter(shouldShowQueueRecord);
  const visibleBookingRecords = bookingRecords;
  const bookingLimit = bookingPage.petId === petId ? bookingPage.limit : BOOKING_PAGE_SIZE;
  const displayedBookingRecords = visibleBookingRecords.slice(0, bookingLimit);
  const remainingBookingCount = Math.max(0, visibleBookingRecords.length - displayedBookingRecords.length);
  const consentRecords = useMemo(() => buildConsentRecords(bookingRecords, queueRecords), [bookingRecords, queueRecords]);
  const activeQueue = visibleQueueRecords.find(item => item.status !== "cancelled");
  const displayedQueue = activeQueue || visibleQueueRecords[0];
  const hasRegisteredOwner = Boolean(pet?.hasOwnership || pet?.ownerUserId || pet?.ownerName);
  const canEditTemporaryOwner = canManageTemporaryOwner && pet && !hasRegisteredOwner;

  const openBookingCancelDialog = (booking) => {
    setConfirmAction({
      type: "booking",
      id: booking.id,
      title: "Cancel booking?",
      description: `Booking ${booking.bookingNumber} for ${pet?.name || "this pet"} will be cancelled.`
    });
  };

  const openRecordDetails = (type, record) => {
    setDetailModal({ type, record });
  };

  const handleConfirmCancel = async () => {
    if (!confirmAction) return;

    setIsCancelling(true);
    try {
      await updateBookingStatus(confirmAction.id, { status: "cancelled" });
      setBookingRecords(records =>
        records.map(item => item.id === confirmAction.id ? { ...item, status: "cancelled" } : item)
      );
      toast.success("Booking cancelled");
      setConfirmAction(null);
    } catch (error) {
      toast.error(error.message || "Cancellation failed");
    } finally {
      setIsCancelling(false);
    }
  };

  const renderRecordDetails = () => {
    if (!detailModal) return null;

    if (detailModal.type === "queue") {
      const queue = detailModal.record;
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Queue ID</p>
              <p className="font-semibold text-lg">{formatQueueReference(queue)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Status</p>
              {getQueueStatusBadge(queue.status)}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Service</p>
              <p className="font-semibold">{getServiceDisplayName(queue.service_name, "Queue")}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Priority</p>
              <p className="font-semibold capitalize">{queue.priority || "normal"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Date & Time</p>
              <p className="font-semibold">{formatDateTime(queue.timestamp)}</p>
            </div>
          </div>
          {queue.complaint && (
            <div className="border-t pt-4">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">Complaint / Notes</p>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{queue.complaint}</p>
            </div>
          )}
          <div className="border-t pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">Queue Source</p>
            <p className="text-sm text-slate-700 capitalize">{queue.queue_source || "admin"}</p>
          </div>
        </div>
      );
    }

    const booking = detailModal.record;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Booking Number</p>
            <p className="font-semibold text-lg">{booking.bookingNumber}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Status</p>
            {getBookingStatusBadge(booking.status)}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Service Type</p>
            <p className="font-semibold">{getServiceDisplayName(booking.service)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Date & Time</p>
            <p className="font-semibold">{formatDisplayDate(booking.date)} at {formatDisplayTime(booking.time)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Type</p>
            <p className="font-semibold">{getServiceDisplayName(booking.type)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Price</p>
            <p className="font-semibold text-blue-600">{formatPhpCurrency(booking.price || 0)}</p>
          </div>
        </div>

        {booking.address && (
          <div className="border-t pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">Service Address</p>
            <p className="font-semibold">{booking.address}</p>
            {booking.emergencyContact && (
              <p className="mt-2 text-sm text-slate-600">Emergency Contact: {booking.emergencyContact}</p>
            )}
          </div>
        )}

        {booking.isOnlineConsultation && (
          <div className="border-t pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3">Consultation Details</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Veterinarian</p>
                <p className="font-semibold">{booking.veterinarian || "Unassigned"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Consult Time</p>
                <p className="font-semibold">{formatDisplayTime(booking.time)}</p>
              </div>
            </div>
          </div>
        )}

        {booking.specialServiceItems?.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3">Special Service Items</p>
            <div className="space-y-3">
              {booking.specialServiceItems.map((item, index) => (
                <div key={`${item.id || item.sequenceNo || index}`} className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{item.serviceTitle || "Special Service"}</p>
                      {item.serviceDescription && <p className="mt-1 text-sm text-slate-600">{item.serviceDescription}</p>}
                    </div>
                    <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700">
                      #{item.sequenceNo || index + 1}
                    </span>
                  </div>
                  {item.serviceDetails && (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{item.serviceDetails}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {booking.hotelBoardingType && (
          <div className="border-t pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3">Stay Details</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Stay Type</p>
                <p className="font-semibold">{getBoardingStayLabel(booking.hotelBoardingType)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Room / Confinement Size</p>
                <p className="font-semibold capitalize">{booking.roomSize || "Not set"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Check-in</p>
                <p className="font-semibold">{formatDisplayDate(booking.checkInDate)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Check-out</p>
                <p className="font-semibold">{formatDisplayDate(booking.checkOutDate)}</p>
              </div>
              {booking.emergencyContact && (
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Emergency Contact</p>
                  <p className="font-semibold">{booking.emergencyContact}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {booking.isHomeService && (
          <div className="border-t pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3">Home Service Details</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Address</p>
                <p className="font-semibold">{booking.address || "Not set"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Date & Time</p>
                <p className="font-semibold">{formatDisplayDate(booking.date)} at {formatDisplayTime(booking.time)}</p>
              </div>
              {booking.emergencyContact && (
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wider text-slate-400 font-bold">Emergency Contact</p>
                  <p className="font-semibold">{booking.emergencyContact}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {booking.addOns?.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">Add-ons</p>
            <div className="flex flex-wrap gap-2">
              {booking.addOns.map((addOn) => (
                <span key={addOn.id || addOn.name} className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                  {addOn.name || addOn.id}
                </span>
              ))}
            </div>
          </div>
        )}

        {booking.image_Booking_Concern_Path && (
          <div className="border-t pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3">Concern Uploads</p>
            <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
              {String(booking.image_Booking_Concern_Path)
                .split(',')
                .map((path) => path.trim())
                .filter(Boolean)
                .map((path, index) => {
                  const isImage = isImageUploadPath(path);

                  if (isImage) {
                    return (
                      <div key={`${path}-${index}`} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        <ProtectedImage src={path} alt={`Concern ${index + 1}`} className="aspect-square w-full object-cover" />
                        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setConsentViewer({ src: path, alt: `Concern ${index + 1}` })}
                            className="h-8 gap-1 text-xs"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => downloadBookingUpload(path)}
                            className="h-8 gap-1 text-xs"
                          >
                            <Download className="h-3 w-3" />
                            Download
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={`${path}-${index}`} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        <span className="flex aspect-square w-full flex-col items-center justify-center gap-3 p-4 text-center">
                          <FileText className="h-10 w-10 text-slate-300" />
                          <span className="max-w-full truncate text-sm font-bold text-slate-700">{uploadFileName(path)}</span>
                        </span>
                        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => viewBookingUpload(path)}
                            className="h-8 gap-1 text-xs"
                          >
                            <Eye className="h-3 w-3" />
                            View
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => downloadBookingUpload(path)}
                            className="h-8 gap-1 text-xs"
                          >
                            <Download className="h-3 w-3" />
                            Download
                          </Button>
                        </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {booking.notes && (
          <div className="border-t pt-4">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">Notes</p>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{booking.notes}</p>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-12 w-12 text-[#155dfc] animate-spin mb-4" />
        <p className="text-gray-600">Loading pet profile...</p>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        <Button variant="ghost" onClick={() => navigate("/dashboard/my-pets")} className="hover:bg-slate-100">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to {backTargetLabel}
        </Button>
        <Card className="border-slate-200">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <PawPrint className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="font-bold text-xl text-slate-900 mb-2">Pet Not Found</h3>
            <p className="text-slate-500 mb-8 max-w-sm mx-auto">
              We couldn't find the pet profile for ID: <span className="font-mono text-blue-600">{petId}</span>. 
              It might have been unlinked or the ID is incorrect.
            </p>
            <Button onClick={() => navigate("/dashboard/my-pets")} className="bg-[#155dfc]">
              Return to {backTargetLabel}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl min-w-0 space-y-6 pb-24 animate-in fade-in duration-500 sm:pb-28">
      <Button variant="ghost" onClick={() => navigate("/dashboard/my-pets")} className="w-fit hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
        <ArrowLeft className="mr-2 size-4" />
        Back to {backTargetLabel}
      </Button>

      <PetIdentityCard
        pet={pet}
        copied={copied}
        flipped={isIdentityCardFlipped}
        canEdit={canEditBasicPetInformation}
        canChangeOwner={canEditTemporaryOwner}
        queueRecord={canViewPetOwnerActivity ? displayedQueue : null}
        queueLoading={canViewPetOwnerActivity && isActivityLoading}
        onCopy={copyToClipboard}
        onEdit={() => setIsPetInformationEditorOpen(true)}
        onChangeOwner={() => {
          setTempOwnerDraft(pet.tempOwnerName || '');
          setIsEditingTempOwner(true);
        }}
        onPhotoChange={handlePetPhotoUpload}
        onFlip={() => setIsIdentityCardFlipped((current) => !current)}
        onOpenQueue={() => displayedQueue && openRecordDetails("queue", displayedQueue)}
      />

      <PetProfileActionDock
        canRequestRecordUpdate={canRequestRecordUpdate}
        activeRecordUpdateRequest={activeRecordUpdateRequest}
        consentCount={consentRecords.length}
        documentCount={pet.prescriptionDocuments?.length || 0}
        bookingCount={visibleBookingRecords.length}
        canViewBookings={canViewPetOwnerActivity}
        onRequestUpdate={() => navigate(`/dashboard/my-pets/${petId}/request-update`)}
        onOpenHistory={handlePrint}
        onOpenConsent={() => setIsConsentPanelOpen(true)}
        onOpenBookings={() => setIsBookingsPanelOpen(true)}
      />

      <div className="hidden" aria-hidden="true">
        {/* Supporting pet details */}
        <div className="lg:col-span-1 space-y-8">
          {pet.hasOwnership && (
            <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  <UserPlus className="size-4 text-[#155dfc]" />
                  Pet Owners
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 p-4 sm:p-6">
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/30">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#155dfc]" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-wide text-blue-600 dark:text-blue-300">Primary owner</p>
                      <p className="truncate text-sm font-black text-slate-900 dark:text-white">
                        {pet.primaryOwner?.name || pet.ownerName || "Pet owner"}
                      </p>
                      {(pet.primaryOwner?.email) && (
                        <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{pet.primaryOwner.email}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-400">
                    Co-parents ({pet.coParents?.length || 0})
                  </p>
                  {pet.coParents?.length ? (
                    <div className="space-y-2">
                      {pet.coParents.map((coParent) => (
                        <div key={coParent.userId} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                          <UserPlus className="mt-0.5 size-4 shrink-0 text-slate-400" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{coParent.name || "Pet owner"}</p>
                            {coParent.email && (
                              <p className="truncate text-xs font-semibold text-slate-500 dark:text-slate-400">{coParent.email}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-200 p-3 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      No approved co-parent is linked to this pet.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {canEditTemporaryOwner && (
            <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                    Owner
                  </CardTitle>
                  {!isEditingTempOwner && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTempOwnerDraft(pet.tempOwnerName || "");
                        setIsEditingTempOwner(true);
                      }}
                      className="h-8 gap-2"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Change
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-4 sm:p-6">
                {isEditingTempOwner ? (
                  <div className="space-y-3">
                    <Input
                      value={tempOwnerDraft}
                      onChange={(event) => setTempOwnerDraft(event.target.value)}
                      restriction="name"
                      placeholder="Owner name"
                      disabled={isSavingTempOwner}
                    />
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        onClick={handleSaveTemporaryOwner}
                        disabled={isSavingTempOwner}
                        className="flex-1 bg-[#155dfc] text-white hover:bg-blue-700"
                      >
                        {isSavingTempOwner ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setTempOwnerDraft(pet.tempOwnerName || "");
                          setIsEditingTempOwner(false);
                        }}
                        disabled={isSavingTempOwner}
                        className="flex-1"
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <PetInfoRow label="Name" value={pet.tempOwnerName || 'Not set'} />
                )}
              </CardContent>
            </Card>
          )}

          {pet.microchipId && (
            <Card className="bg-blue-600 border-none shadow-lg shadow-blue-200 rounded-2xl overflow-hidden">
              <CardContent className="p-6 relative">
                <div className="absolute right-0 top-0 h-full w-1/2 bg-white/10 skew-x-[-20deg] translate-x-8" />
                <div className="flex items-center gap-4 relative z-10">
                  <div className="p-3 bg-white/20 rounded-xl text-white backdrop-blur-md">
                    <Check className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-100 font-black uppercase tracking-widest">Microchip Verified</p>
                    <p className="font-mono text-xl text-white font-black mt-1 tracking-wider">{pet.microchipId}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Allergies Card */}
          <Card className={`rounded-2xl shadow-sm overflow-hidden ${pet.allergies?.length > 0 ? "border-red-100" : "border-slate-200"}`}>
            <CardHeader className="bg-red-50/50 border-b border-red-100 dark:bg-[#2a1517] dark:border-[#7f1d1d]">
              <CardTitle className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-[#991b1b] dark:text-[#ef4444]">
                <AlertCircle className="h-4 w-4 text-[#991b1b] dark:text-[#ef4444]" />
                Critical Allergies
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {pet.allergies?.length > 0 ? (
                <div className="space-y-3">
                  {pet.allergies.map((allergy, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-xl border border-red-50 shadow-sm">
                      <p className="font-black text-red-600 text-sm uppercase tracking-tight">{allergy.allergen}</p>
                      <p className="text-xs text-slate-400 mt-1 font-medium italic">{allergy.severity} Reaction Type</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                    <p className="text-sm text-slate-400 font-medium">No known clinical allergies recorded.</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Clinical activity */}
        <div className="lg:col-span-2 space-y-8">
          <PrescriptionDocumentsPanel
            documents={pet.prescriptionDocuments || []}
            onPreview={(document) => setConsentViewer(document)}
          />

          {canViewPetOwnerActivity && (
            <>
              <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-4 py-5 sm:px-8 sm:py-6">
                  <CardTitle className="text-xl font-black text-slate-800 flex items-center gap-3">
                    <ClipboardList className="h-6 w-6 text-[#155dfc]" />
                    Queue Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-8">
                  {isActivityLoading ? (
                    <div className="flex items-center gap-3 text-slate-500">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Loading queue status...
                    </div>
                  ) : displayedQueue ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                          {activeQueue ? "Current Queue" : "Recent Cancelled Queue"}
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-3xl font-black text-slate-900">{formatQueueReference(displayedQueue)}</span>
                          {getQueueStatusBadge(displayedQueue.status)}
                        </div>
                        <p className="text-sm text-slate-500 mt-3">
                          {getServiceDisplayName(displayedQueue.service_name, "Queue")} - {formatDateTime(displayedQueue.timestamp)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => openRecordDetails("queue", displayedQueue)}
                          className="sm:w-auto"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="font-bold text-slate-900">No active queue entry</p>
                      <p className="text-sm text-slate-500 mt-1">Pending queues and cancelled re-entry holders appear here.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-4 py-5 sm:px-8 sm:py-6">
                  <CardTitle className="text-xl font-black text-slate-800 flex items-center gap-3">
                    <CalendarClock className="h-6 w-6 text-[#155dfc]" />
                    Bookings
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {isActivityLoading ? (
                    <div className="flex items-center gap-3 p-4 text-slate-500 sm:p-8">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Loading bookings...
                    </div>
                  ) : visibleBookingRecords.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {displayedBookingRecords.map((booking) => {
                        const canCancelBooking = booking.status !== "completed" && booking.status !== "cancelled";
                        return (
                          <div key={booking.id} className="relative p-4 sm:p-6">
                            <button
                              type="button"
                              onClick={() => openRecordDetails("booking", booking)}
                              className={`min-w-0 w-full rounded-lg text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#155dfc]/30 ${canCancelBooking ? "pr-24 sm:pr-28" : ""}`}
                            >
                              <div className="p-2">
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                  <p className="font-black text-slate-900">{booking.bookingNumber}</p>
                                  {getBookingStatusBadge(booking.status)}
                                </div>
                                <p className="text-sm font-semibold text-slate-700">{getServiceDisplayName(booking.service)}</p>
                                <p className="text-sm text-slate-500 mt-1">{formatDateTime(booking.date, booking.time)}</p>
                              </div>
                            </button>
                            {canCancelBooking && (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                <Button
                                  variant="outline"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openBookingCancelDialog(booking);
                                  }}
                                  className="border-red-200 text-red-600 hover:bg-red-50"
                                >
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {remainingBookingCount > 0 && (
                        <div className="bg-white px-4 py-3 sm:px-6">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setBookingPage((current) => ({
                              petId,
                              limit: (current.petId === petId ? current.limit : BOOKING_PAGE_SIZE) + BOOKING_PAGE_SIZE
                            }))}
                            className="h-9 w-full text-sm font-black"
                          >
                            Load more bookings ({remainingBookingCount})
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="px-4 py-12 text-center sm:px-8">
                      <p className="font-bold text-slate-900">No bookings recorded</p>
                      <p className="text-sm text-slate-500 mt-1">This pet&apos;s current and completed bookings will appear here.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      <ConsentImagesPanel
        records={consentRecords}
        documents={pet.prescriptionDocuments || []}
        isLoading={isActivityLoading}
        open={isConsentPanelOpen}
        onOpenChange={setIsConsentPanelOpen}
        onPreview={(record) => setConsentViewer({
          src: record.src || record.url || record.relativeUrl,
          alt: record.alt || record.identifier || record.name || 'Pet file'
        })}
      />

      <PetBookingsDialog
        open={isBookingsPanelOpen}
        onOpenChange={setIsBookingsPanelOpen}
        isLoading={isActivityLoading}
        bookings={displayedBookingRecords}
        totalCount={visibleBookingRecords.length}
        remainingCount={remainingBookingCount}
        getStatusBadge={getBookingStatusBadge}
        onView={(booking) => {
          setIsBookingsPanelOpen(false);
          openRecordDetails("booking", booking);
        }}
        onCancel={(booking) => {
          setIsBookingsPanelOpen(false);
          openBookingCancelDialog(booking);
        }}
        onLoadMore={() => setBookingPage((current) => ({
          petId,
          limit: (current.petId === petId ? current.limit : BOOKING_PAGE_SIZE) + BOOKING_PAGE_SIZE
        }))}
      />

      <Dialog open={isEditingTempOwner} onOpenChange={(open) => !isSavingTempOwner && setIsEditingTempOwner(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change temporary owner</DialogTitle>
            <DialogDescription>Update the owner name shown on this pet ID.</DialogDescription>
          </DialogHeader>
          <Input
            value={tempOwnerDraft}
            onChange={(event) => setTempOwnerDraft(event.target.value)}
            restriction="name"
            placeholder="Owner name"
            disabled={isSavingTempOwner}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsEditingTempOwner(false)} disabled={isSavingTempOwner}>Cancel</Button>
            <Button type="button" onClick={handleSaveTemporaryOwner} disabled={isSavingTempOwner} className="bg-[#155dfc] text-white hover:bg-blue-700">
              {isSavingTempOwner ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
              Save owner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!confirmAction}
        onOpenChange={(open) => {
          if (!open && !isCancelling) {
            setConfirmAction(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmAction?.title}</DialogTitle>
            <DialogDescription>
              {confirmAction?.description} This action can be changed later only by clinic staff.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmAction(null)}
              disabled={isCancelling}
            >
              Keep
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Confirm Cancel"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!detailModal}
        onOpenChange={(open) => {
          if (!open) {
            setDetailModal(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailModal?.type === "queue" ? <ClipboardList className="h-5 w-5 text-[#155dfc]" /> : <CalendarClock className="h-5 w-5 text-[#155dfc]" />}
              {detailModal?.type === "queue" ? "Queue Details" : "Booking Details"}
            </DialogTitle>
            <DialogDescription>
              {detailModal?.type === "queue"
                ? "View the queue entry information recorded for this pet."
                : "View the booking details recorded for this pet. Payment proof is intentionally hidden here."}
            </DialogDescription>
          </DialogHeader>

          {renderRecordDetails()}
        </DialogContent>
      </Dialog>
      <PhotoViewer
        open={Boolean(consentViewer)}
        src={consentViewer?.src || consentViewer?.path || consentViewer?.url || ""}
        alt={consentViewer?.alt || "Consent document"}
        onOpenChange={(open) => !open && setConsentViewer(null)}
      />
      {isPetInformationEditorOpen && (
        <EditPetInformationDialog
          petId={pet.id || pet.db_id}
          onClose={() => setIsPetInformationEditorOpen(false)}
          onSaved={(updatedPet) => setPet(updatedPet)}
        />
      )}
    </div>
  );
}

const SIGNED_CONSENT_PATH_KEYS = [
  "documentPath",
  "document_path",
  "consentDocumentPath",
  "consent_document_path",
  "signedDocumentPath",
  "signed_document_path",
  "signedConsentDocumentPath",
  "signed_consent_document_path",
  "signedFilePath",
  "signed_file_path",
];

const PHYSICAL_CONSENT_PATH_KEYS = [
  "physicalConsentPath",
  "physical_consent_path",
  "physicalFilePath",
  "physical_file_path",
];

function firstConsentArtifactPath(record, keys) {
  if (!record || typeof record !== "object") return "";

  for (const key of keys) {
    const path = String(record[key] || "").trim();
    if (path) return path;
  }

  return "";
}

function consentRecordArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizedConsentArtifactKey(path) {
  const rawPath = String(path || "").trim().replace(/\\/g, "/");
  if (!rawPath) return "";

  let normalizedPath = rawPath.split(/[?#]/)[0];
  if (/^https?:\/\//i.test(normalizedPath)) {
    try {
      normalizedPath = new URL(normalizedPath).pathname;
    } catch {
      // Keep the original path when an older stored URL cannot be parsed.
    }
  }

  return normalizedPath
    .replace(/^\/+/, "")
    .replace(/^public\//i, "")
    .replace(/^api\/uploads\/media\//i, "")
    .replace(/^uploads\/media\//i, "")
    .toLowerCase();
}

function buildConsentRecords(bookings, queues) {
  const records = [];
  const seen = new Set();

  const addRecord = (record) => {
    const path = consentDocumentPath(record);
    const canReconstruct = canReconstructConsentDocument(record, record.fallbackSignaturePath);
    if (!path && !canReconstruct) return;

    const storedArtifactKey = normalizedConsentArtifactKey(path);
    const legacyArtifactKey = normalizedConsentArtifactKey(
      record.legacySignaturePath || record.fallbackSignaturePath
    );
    const key = storedArtifactKey
      ? `stored:${storedArtifactKey}`
      : `reconstructed:${legacyArtifactKey}:${String(record.content || "").trim()}`;
    if (seen.has(key)) return;
    seen.add(key);

    records.push({
      ...record,
      path,
      url: path ? resolveImageUrl(path) : "",
      consentId: [
        "CONSENT",
        String(record.source).toUpperCase(),
        record.sourceId || records.length + 1,
        record.formId || "",
      ].filter(Boolean).join("-"),
    });
  };

  bookings.forEach((booking) => {
    const rawForms = consentRecordArray(booking.consentForms);
    const commonRecord = {
      source: "booking",
      sourceLabel: "Booking Consent",
      sourceId: booking.id,
      identifier: booking.bookingNumber || `Booking #${booking.id}`,
      service: getServiceDisplayName(booking.service || booking.type, "Booking"),
      ownerLabel: booking.ownerName || "Pet owner",
      veterinarianName: booking.veterinarian || "Veterinarian",
    };

    rawForms.forEach((rawForm, index) => {
      const form = normalizeConsentForms([rawForm])[0];
      if (!form) return;

      const signedDocumentPath = firstConsentArtifactPath(rawForm, SIGNED_CONSENT_PATH_KEYS);
      const physicalDocumentPath = firstConsentArtifactPath(rawForm, PHYSICAL_CONSENT_PATH_KEYS);
      const formId = form.id || index + 1;
      const formRecord = {
        ...commonRecord,
        ...form,
        formId,
        fallbackSignaturePath: form.legacySignaturePath || booking.legacyConsentSignaturePath,
        dateLabel: formatDisplayDateTime(form.signedAt || booking.date || booking.createdAt, booking.time),
        ownerLabel: form.signerName || commonRecord.ownerLabel,
        veterinarianName: form.veterinarianName || commonRecord.veterinarianName,
      };

      if (signedDocumentPath) {
        addRecord({
          ...formRecord,
          documentPath: signedDocumentPath,
          formId: `${formId}-signed`,
        });
      }

      if (physicalDocumentPath) {
        addRecord({
          ...formRecord,
          title: `${form.title || "Consent Form"} - Physical Upload`,
          documentPath: physicalDocumentPath,
          sourceLabel: "Physical Booking Consent",
          formId: `${formId}-physical`,
        });
      }

      if (!signedDocumentPath && !physicalDocumentPath) {
        addRecord(formRecord);
      }
    });

    const bookingDocumentPath = firstConsentArtifactPath(booking, SIGNED_CONSENT_PATH_KEYS);
    if (bookingDocumentPath) {
      addRecord({
        ...commonRecord,
        ...booking,
        documentPath: bookingDocumentPath,
        dateLabel: formatDisplayDateTime(booking.date || booking.createdAt, booking.time),
      });
    }

    const bookingPhysicalPath = firstConsentArtifactPath(booking, PHYSICAL_CONSENT_PATH_KEYS);
    if (bookingPhysicalPath) {
      addRecord({
        ...commonRecord,
        title: "Booking Consent - Physical Upload",
        documentPath: bookingPhysicalPath,
        sourceLabel: "Physical Booking Consent",
        formId: "physical",
        dateLabel: formatDisplayDateTime(booking.date || booking.createdAt, booking.time),
      });
    }
  });

  queues.forEach((queue) => {
    const queueReference = formatQueueReference(queue) || `Queue ID ${queue.queue_id}`;
    const commonRecord = {
      source: "queue",
      sourceLabel: "Queue Consent",
      sourceId: queue.queue_id,
      identifier: queueReference,
      service: getServiceDisplayName(queue.service_name, "Queue"),
      dateLabel: formatDisplayDateTime(queue.timestamp),
      ownerLabel: "Pet owner",
    };
    const aggregatedRecords = consentRecordArray(queue.consent_records || queue.consentRecords);

    aggregatedRecords.forEach((consentRecord, index) => {
      if (!consentRecord || typeof consentRecord !== "object") return;

      const normalizedForm = normalizeConsentForms([consentRecord])[0] || {};
      const recordId = consentRecord.consent_record_id
        || consentRecord.consentRecordId
        || normalizedForm.id
        || index + 1;
      const signedDocumentPath = firstConsentArtifactPath(consentRecord, SIGNED_CONSENT_PATH_KEYS);
      const physicalDocumentPath = firstConsentArtifactPath(consentRecord, PHYSICAL_CONSENT_PATH_KEYS);
      const consentTitle = consentRecord.consent_type
        || consentRecord.consentType
        || normalizedForm.title
        || "Queue Consent";
      const dateLabel = formatDisplayDateTime(
        consentRecord.signed_at
          || consentRecord.signedAt
          || consentRecord.released_at
          || consentRecord.releasedAt
          || consentRecord.created_at
          || consentRecord.createdAt
          || queue.timestamp
      );
      const recordDetails = {
        ...commonRecord,
        ...normalizedForm,
        title: consentTitle,
        formId: recordId,
        dateLabel,
        ownerLabel: consentRecord.signer_name || consentRecord.signerName || "Pet owner",
        service: getServiceDisplayName(
          consentRecord.service_name || consentRecord.serviceName || queue.service_name,
          "Queue"
        ),
        fallbackSignaturePath: normalizedForm.legacySignaturePath,
      };

      if (signedDocumentPath) {
        addRecord({
          ...recordDetails,
          documentPath: signedDocumentPath,
          formId: `${recordId}-signed`,
        });
      }

      if (physicalDocumentPath) {
        addRecord({
          ...recordDetails,
          title: `${consentTitle} - Physical Upload`,
          documentPath: physicalDocumentPath,
          sourceLabel: "Physical Queue Consent",
          formId: `${recordId}-physical`,
        });
      }

      if (!signedDocumentPath && !physicalDocumentPath) {
        addRecord(recordDetails);
      }
    });

    [
      {
        path: queue.signed_consent_document_path || queue.signedConsentDocumentPath,
        sourceLabel: "Queue Consent",
        formId: "latest-signed",
      },
      {
        path: queue.physical_consent_path || queue.physicalConsentPath,
        sourceLabel: "Physical Queue Consent",
        formId: "latest-physical",
      },
    ].forEach((artifact) => {
      if (!artifact.path) return;

      addRecord({
        ...commonRecord,
        documentPath: artifact.path,
        sourceLabel: artifact.sourceLabel,
        formId: artifact.formId,
      });
    });
  });

  return records;
}

function PetIdentityCard({ pet, copied, flipped, canEdit, canChangeOwner, queueRecord, queueLoading, onCopy, onEdit, onChangeOwner, onPhotoChange, onFlip, onOpenQueue }) {
  const vaccinations = Array.isArray(pet.vaccinations) ? pet.vaccinations : [];
  const ownerName = pet.hasOwnership
    ? (pet.primaryOwner?.name || pet.ownerName || 'Pet owner')
    : (pet.tempOwnerName || 'Not assigned');
  const status = pet.status || 'Registered';
  const normalizedStatus = status.toLowerCase();
  const statusClass = normalizedStatus === 'healthy'
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
    : normalizedStatus === 'emergency'
      ? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300'
      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300';
  const details = [
    ['Species', pet.species || 'N/A'],
    ['Primary breed', pet.breed || 'N/A'],
    ['Birth date', formatDisplayDate(pet.birthDate)],
    ['Estimated age', calculateAge(pet.birthDate) || pet.age || 'N/A'],
    ['Sex / gender', pet.gender || 'N/A'],
    ['Body weight', pet.weight ? `${pet.weight} kg` : 'N/A'],
    ['Coloration', pet.color || 'N/A'],
    ['Registered owner', `${ownerName}${pet.coParents?.length ? ` + ${pet.coParents.length} co-parent${pet.coParents.length === 1 ? '' : 's'}` : ''}`],
  ];
  const allergyNames = Array.isArray(pet.allergies)
    ? pet.allergies.map((allergy) => allergy?.allergen).filter(Boolean)
    : [];

  return (
    <section className="pet-id-entrance" aria-label={`${pet.name} pet identification card`}>
      <div className="pet-id-flip-shell">
        <div className={`pet-id-flip-card ${flipped ? 'is-flipped' : ''}`}>
          <article
            className={`pet-id-face pet-id-face--front min-h-[440px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-950/10 dark:border-slate-700 dark:bg-slate-900 ${flipped ? 'pointer-events-none' : ''}`}
            aria-hidden={flipped}
          >
            <div className="h-1.5 bg-[#155dfc]" />
            <div className="flex flex-col gap-5 p-4 sm:p-6">
              <header className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="flex min-w-0 items-center gap-3">
                  <img src={navigationLogo} alt="iPawcus logo" className="size-10 shrink-0 object-contain" />
                  <div className="min-w-0">
                    <p className="text-lg font-black tracking-tight text-[#155dfc] dark:text-blue-300">iPawcus</p>
                    <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">VetFocus Care</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-start justify-end gap-2">
                  <div className="min-w-0 text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Registration ID</p>
                    <div className="mt-1 flex items-center justify-end gap-1">
                      <code className="max-w-[7rem] truncate font-mono text-xs font-black text-slate-950 dark:text-white sm:max-w-none sm:text-sm">{pet.id}</code>
                      <Button type="button" variant="ghost" size="icon" onClick={onCopy} tabIndex={flipped ? -1 : 0} className="size-7 rounded-md active:scale-[0.96]" aria-label="Copy pet registration ID">
                        {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5 text-slate-400" />}
                      </Button>
                    </div>
                  </div>
                  {(queueLoading || queueRecord) ? (
                    <button
                      type="button"
                      onClick={onOpenQueue}
                      disabled={!queueRecord}
                      tabIndex={flipped ? -1 : 0}
                      className="pet-queue-stamp min-w-[5.25rem] rounded-lg border-2 border-blue-300 bg-blue-50 px-2.5 py-1.5 text-center text-[#155dfc] outline-none transition-[background-color,border-color,transform] duration-200 hover:border-blue-400 hover:bg-blue-100 focus-visible:ring-2 focus-visible:ring-[#155dfc] focus-visible:ring-offset-2 disabled:cursor-wait dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950"
                      aria-label={queueRecord ? `Open queue ${formatQueueReference(queueRecord)} details` : 'Loading queue status'}
                    >
                      <span className="block text-[9px] font-black uppercase tracking-[0.18em]">Queue</span>
                      <span className="mt-0.5 block whitespace-nowrap font-mono text-xs font-black sm:text-sm">
                        {queueLoading && !queueRecord ? '...' : formatQueueReference(queueRecord)}
                      </span>
                    </button>
                  ) : null}
                  </div>
              </header>

              <div className="grid grid-cols-[104px_minmax(0,1fr)] items-stretch gap-4 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-5">
                <div className="flex items-center justify-center sm:justify-start">
                  <div className="relative">
                    <div className="size-24 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800 sm:size-32">
                      {pet.profileImage ? (
                        <ProtectedImage src={pet.profileImage} alt={pet.name} className="h-full w-full object-cover" fallbackClassName="h-full w-full" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-slate-50 dark:bg-slate-800">
                          <PawPrint className="size-14 text-blue-200 dark:text-blue-800" />
                        </div>
                      )}
                    </div>
                    <input id="pet-profile-image-upload" type="file" className="hidden" accept="image/*" onChange={onPhotoChange} />
                    <Button
                      type="button"
                      size="icon"
                      onClick={() => document.getElementById('pet-profile-image-upload')?.click()}
                      tabIndex={flipped ? -1 : 0}
                      className="absolute -bottom-2 -right-2 size-9 rounded-full bg-[#155dfc] text-white shadow-md hover:bg-blue-700 active:scale-[0.96]"
                      aria-label="Change pet profile photo"
                    >
                      <Camera className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex h-full min-h-24 flex-wrap content-center items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800 sm:min-h-32 sm:px-5">
                    <span className="basis-full text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Pet profile</span>
                    <h1 className="min-w-0 break-words text-xl font-black tracking-tight text-slate-950 dark:text-white sm:text-2xl">{pet.name}</h1>
                    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${statusClass}`}>
                      {status}
                    </span>
                    {canEdit ? (
                      <Button type="button" variant="ghost" size="sm" onClick={onEdit} tabIndex={flipped ? -1 : 0} className="ml-auto h-8 shrink-0 gap-1.5 px-2.5 text-xs font-black text-[#155dfc] active:scale-[0.97] dark:text-blue-300">
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                    ) : null}
                  </div>
                </div>

                <section className="col-span-2 min-w-0 border-t border-slate-100 pt-4 dark:border-slate-800" aria-labelledby="pet-personal-information-heading">
                  <h2 id="pet-personal-information-heading" className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Personal information</h2>
                  <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3 lg:grid-cols-4">
                    {details.map(([label, value]) => (
                      <div key={label} className="min-w-0">
                        <dt className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</dt>
                        <dd className="mt-1 break-words text-sm font-bold text-slate-800 dark:text-slate-100">{value || 'N/A'}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2 ${allergyNames.length ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300' : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'}`}>
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <p className="min-w-0 break-words text-xs font-bold">
                      {allergyNames.length ? `Known allergies: ${allergyNames.join(', ')}` : 'No known clinical allergies recorded.'}
                    </p>
                  </div>
                </section>
              </div>

              <footer className="mt-auto flex items-end justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Microchip ID</p>
                  <p className="mt-1 truncate font-mono text-xs font-bold text-slate-700 dark:text-slate-200">{pet.microchipId || 'Not recorded'}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {canChangeOwner ? (
                    <Button type="button" variant="ghost" onClick={onChangeOwner} tabIndex={flipped ? -1 : 0} className="gap-2 text-slate-600 active:scale-[0.97] dark:text-slate-300">
                      <UserPlus className="size-4" />
                      Change owner
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" onClick={onFlip} tabIndex={flipped ? -1 : 0} className="gap-2 border-blue-200 text-[#155dfc] active:scale-[0.97] dark:border-blue-800 dark:text-blue-300" aria-label="Show vaccination records on the back of the pet ID">
                    <Syringe className="size-4" />
                    Vaccinations
                  </Button>
                </div>
              </footer>
            </div>
          </article>

          <article
            className={`pet-id-face pet-id-face--back min-h-[440px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-950/10 dark:border-slate-700 dark:bg-slate-900 ${flipped ? '' : 'pointer-events-none'}`}
            aria-hidden={!flipped}
          >
            <div className="h-1.5 bg-[#155dfc]" />
            <div className="flex min-h-[438px] flex-col p-4 sm:p-6">
              <header className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#155dfc] dark:bg-blue-950/60 dark:text-blue-300">
                    <Syringe className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-base font-black text-slate-950 dark:text-white">Vaccination records</h2>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{vaccinations.length} saved {vaccinations.length === 1 ? 'record' : 'records'}</p>
                  </div>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Pet ID</p>
                  <code className="mt-1 block max-w-[9rem] truncate font-mono text-xs font-black text-slate-950 dark:text-white sm:max-w-none">{pet.id}</code>
                </div>
              </header>

              {vaccinations.length ? (
                <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="hidden grid-cols-[minmax(0,1.2fr)_0.9fr_0.9fr_1fr_0.8fr] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 md:grid">
                    <span>Vaccine</span>
                    <span>Date given</span>
                    <span>Next due</span>
                    <span>Veterinarian</span>
                    <span>Status</span>
                  </div>
                  <div className="max-h-[250px] overflow-y-auto overscroll-contain">
                    {vaccinations.map((vaccination, index) => (
                      <VaccinationRow key={vaccination.id || index} vax={vaccination} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="my-auto flex flex-1 flex-col items-center justify-center py-10 text-center">
                  <Syringe className="size-10 text-slate-200 dark:text-slate-700" />
                  <p className="mt-3 text-sm font-black text-slate-800 dark:text-slate-100">No vaccination records yet</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Clinic-recorded vaccines will appear here.</p>
                </div>
              )}

              <footer className="mt-4 flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
                <Button type="button" variant="outline" onClick={onFlip} tabIndex={flipped ? 0 : -1} className="gap-2 border-blue-200 text-[#155dfc] active:scale-[0.97] dark:border-blue-800 dark:text-blue-300" aria-label="Show personal information on the front of the pet ID">
                  <RotateCw className="size-4" />
                  View personal information
                </Button>
              </footer>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function PetProfileActionDock({ canRequestRecordUpdate, activeRecordUpdateRequest, consentCount, documentCount, bookingCount, canViewBookings, onRequestUpdate, onOpenHistory, onOpenConsent, onOpenBookings }) {
  const requestDisabled = !canRequestRecordUpdate || Boolean(activeRecordUpdateRequest);
  const linkedFileCount = consentCount + documentCount;

  return (
    <div className="pet-action-dock-anchor pointer-events-none fixed inset-x-0 z-40 px-3 sm:px-5">
    <nav className="pet-action-dock pointer-events-auto mx-auto grid w-full max-w-2xl grid-cols-4 gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-950/15 dark:border-slate-700 dark:bg-slate-900" aria-label="Pet profile actions">
      <button
        type="button"
        disabled={requestDisabled}
        onClick={onRequestUpdate}
        className="group flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-2 text-center text-slate-700 outline-none transition-[background-color,color,transform] duration-200 hover:bg-blue-50 hover:text-[#155dfc] focus-visible:ring-2 focus-visible:ring-[#155dfc] disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent dark:text-slate-200 dark:hover:bg-blue-950/50 dark:hover:text-blue-300 dark:disabled:text-slate-600"
        aria-label={activeRecordUpdateRequest ? 'Record update request is in progress' : 'Request a pet record update'}
      >
        <ClipboardPenLine className="size-4" aria-hidden="true" />
        <span className="truncate text-[11px] font-black sm:text-xs">Update Record</span>
        <span className="hidden text-[9px] font-bold text-slate-400 sm:block">{activeRecordUpdateRequest ? 'In progress' : canRequestRecordUpdate ? 'Request correction' : 'Owner access only'}</span>
      </button>
      <button
        type="button"
        onClick={onOpenHistory}
        className="group flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-2 text-center text-slate-700 outline-none transition-[background-color,color,transform] duration-200 hover:bg-blue-50 hover:text-[#155dfc] focus-visible:ring-2 focus-visible:ring-[#155dfc] dark:text-slate-200 dark:hover:bg-blue-950/50 dark:hover:text-blue-300"
        aria-label="Open pet health history"
      >
        <HeartPulse className="size-4" aria-hidden="true" />
        <span className="truncate text-[11px] font-black sm:text-xs">Health History</span>
        <span className="hidden text-[9px] font-bold text-slate-400 sm:block">Clinical timeline</span>
      </button>
      <button
        type="button"
        onClick={onOpenConsent}
        className="group flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-2 text-center text-slate-700 outline-none transition-[background-color,color,transform] duration-200 hover:bg-blue-50 hover:text-[#155dfc] focus-visible:ring-2 focus-visible:ring-[#155dfc] dark:text-slate-200 dark:hover:bg-blue-950/50 dark:hover:text-blue-300"
        aria-label={`Open consent and pet files (${linkedFileCount})`}
      >
        <ShieldCheck className="size-4" aria-hidden="true" />
        <span className="truncate text-[11px] font-black sm:text-xs">Consent Files</span>
        <span className="hidden text-[9px] font-bold text-slate-400 sm:block">{linkedFileCount} linked</span>
      </button>
      <button
        type="button"
        disabled={!canViewBookings}
        onClick={onOpenBookings}
        className="group flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-2 text-center text-slate-700 outline-none transition-[background-color,color,transform] duration-200 hover:bg-blue-50 hover:text-[#155dfc] focus-visible:ring-2 focus-visible:ring-[#155dfc] disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent dark:text-slate-200 dark:hover:bg-blue-950/50 dark:hover:text-blue-300 dark:disabled:text-slate-600"
        aria-label={`Open ${bookingCount} pet ${bookingCount === 1 ? 'booking' : 'bookings'}`}
      >
        <CalendarClock className="size-4" aria-hidden="true" />
        <span className="truncate text-[11px] font-black sm:text-xs">Bookings</span>
        <span className="hidden text-[9px] font-bold text-slate-400 sm:block">{canViewBookings ? `${bookingCount} records` : 'Owner access only'}</span>
      </button>
    </nav>
    </div>
  );
}

function PetBookingsDialog({ open, onOpenChange, isLoading, bookings, totalCount, remainingCount, getStatusBadge, onView, onCancel, onLoadMore }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-200 px-5 pb-4 pt-5 dark:border-slate-700">
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-5 text-[#155dfc]" />
            Pet Bookings
          </DialogTitle>
          <DialogDescription>{totalCount} booking {totalCount === 1 ? 'record' : 'records'} linked to this pet.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5 sm:px-5">
          {isLoading ? (
            <div className="flex min-h-48 items-center justify-center gap-3 text-sm font-semibold text-slate-500 dark:text-slate-400">
              <Loader2 className="size-5 animate-spin text-[#155dfc]" />
              Loading bookings...
            </div>
          ) : bookings.length ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {bookings.map((booking) => {
                const canCancel = booking.status !== 'completed' && booking.status !== 'cancelled';

                return (
                  <article key={booking.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                    <button type="button" onClick={() => onView(booking)} className="min-w-0 flex-1 rounded-lg p-2 text-left outline-none transition-colors duration-150 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#155dfc] dark:hover:bg-slate-800">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-slate-950 dark:text-white">{booking.bookingNumber}</p>
                        {getStatusBadge(booking.status)}
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">{getServiceDisplayName(booking.service)}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{formatDisplayDateTime(booking.date, booking.time)}</p>
                    </button>
                    <div className="flex shrink-0 gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => onView(booking)} className="flex-1 gap-1.5 sm:flex-none">
                        <Eye className="size-3.5" />
                        View
                      </Button>
                      {canCancel ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => onCancel(booking)} className="flex-1 border-red-200 text-red-600 hover:bg-red-50 sm:flex-none dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40">
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
              {remainingCount > 0 ? (
                <div className="py-4">
                  <Button type="button" variant="outline" onClick={onLoadMore} className="w-full">Load more bookings ({remainingCount})</Button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <CalendarClock className="size-9 text-slate-300 dark:text-slate-700" />
              <p className="mt-3 text-sm font-black text-slate-900 dark:text-white">No bookings recorded</p>
              <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">New and completed bookings will appear here.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConsentImagesPanel({ records, documents, isLoading, open, onOpenChange, onPreview }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto sm:max-w-xl">
        <div className="p-5 sm:p-6">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-xl font-black text-slate-950 dark:text-white">
              <ShieldCheck className="h-5 w-5 text-[#155dfc]" />
              Consent & Pet Files
            </SheetTitle>
            <SheetDescription>
              Review consent forms and prescription documents without leaving the pet ID.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Consent documents</h3>
                <Badge className="border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{records.length}</Badge>
              </div>
              {isLoading ? (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  <Loader2 className="size-4 animate-spin text-[#155dfc]" />
                  Loading consent documents...
                </div>
              ) : records.length ? (
                <div className="space-y-3">
                  {records.map((record) => (
                    <ConsentRecordCard key={`${record.source}-${record.sourceId}-${record.formId || record.url}`} record={record} onPreview={onPreview} />
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">No signed consent document has been recorded yet.</p>
              )}
            </section>
            <PrescriptionDocumentsPanel documents={documents} onPreview={onPreview} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ConsentRecordCard({ record, onPreview }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const {
    source,
    isPdf,
    isLoading,
    isReconstructed,
    isUnavailable,
  } = useConsentDocumentSource(record, record.fallbackSignaturePath);

  const handleView = async () => {
    if (!source || isOpening) return;
    if (!isPdf) {
      onPreview({ ...record, path: source, url: source });
      return;
    }

    setIsOpening(true);
    try {
      await openProtectedDocument(source);
    } catch (error) {
      console.error('Failed to open a consent PDF:', error);
      toast.error('The consent PDF could not be opened. Please try again.');
    } finally {
      setIsOpening(false);
    }
  };

  const handleDownload = async () => {
    if (!source || isDownloading) return;

    setIsDownloading(true);
    try {
      await downloadConsentDocument(source, record.consentId);
    } catch (error) {
      toast.error(error.message || "Could not download the complete consent form.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={handleView}
          disabled={!source || isOpening}
          className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-blue-600 transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-700 dark:hover:bg-blue-950/40"
          aria-label={`Open ${record.title || record.sourceLabel}`}
        >
          {source && !isPdf ? (
            <ProtectedImage
              src={source}
              alt=""
              className="h-full w-full object-cover"
              fallbackClassName="h-full w-full"
            />
          ) : isLoading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <FileText className="size-6" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-black text-slate-900 dark:text-white">
            {record.title || record.sourceLabel}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {[record.sourceLabel, record.service].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">{record.identifier}</p>
          {(isReconstructed || isUnavailable) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {isReconstructed && <Badge className="border-0 bg-amber-50 text-amber-700">Legacy document</Badge>}
              {isUnavailable && <Badge className="border-0 bg-amber-50 text-amber-700">Unavailable</Badge>}
            </div>
          )}
        </div>

        <div className={`grid shrink-0 gap-2 ${isPdf ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleView}
              disabled={!source || isOpening}
              className="gap-2"
            >
              {isOpening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              {isPdf ? 'Open PDF' : 'View'}
            </Button>
            {!isPdf && <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!source || isDownloading}
              className="gap-2"
            >
              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download
            </Button>}
        </div>
      </div>
    </article>
  );
}

function VaccinationRecordsPanel({ vaccinations }) {
  return (
    <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-blue-100 bg-blue-50/50 px-4 py-4 sm:px-6">
        <CardTitle className="flex items-center gap-3 text-lg font-black text-slate-800">
          <Syringe className="h-6 w-6 text-[#155dfc]" />
          Vaccination Records
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {vaccinations.length > 0 ? (
          <div>
            <div className="hidden grid-cols-[minmax(0,1.2fr)_0.9fr_0.9fr_1fr_0.8fr] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-500 md:grid">
              <span>Vaccine</span>
              <span>Date Given</span>
              <span>Next Due</span>
              <span>Veterinarian</span>
              <span>Status</span>
            </div>
            {vaccinations.map((vax, index) => (
              <VaccinationRow key={vax.id || index} vax={vax} />
            ))}
          </div>
        ) : (
          <div className="px-4 py-12 text-center sm:px-8">
            <Syringe className="mx-auto mb-4 h-10 w-10 text-slate-200" />
            <h4 className="text-lg font-bold text-slate-900">No Vaccination Data</h4>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PrescriptionDocumentsPanel({ documents, onPreview }) {
  return (
    <Card className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
      <CardHeader className="border-b border-blue-100 bg-blue-50/50 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-3 text-lg font-black text-slate-800">
            <FileText className="h-6 w-6 text-[#155dfc]" />
            Prescription Documents
          </CardTitle>
          <Badge className="w-fit border-0 bg-blue-50 text-blue-700">{documents.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-5">
        {documents.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {documents.map((document) => (
              <PetPrescriptionDocumentCard
                key={document.id || document.url || document.relativeUrl}
                document={document}
                onPreview={onPreview}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-400">
            No prescription documents saved.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PetPrescriptionDocumentCard({ document, onPreview }) {
  const [isOpening, setIsOpening] = useState(false);
  const rawPath = document.url || document.relativeUrl || "";
  const title = document.name || "Prescription document";
  const canPreview = isImageUploadPath(rawPath);

  const handleView = async () => {
    if (!rawPath || isOpening) return;
    if (canPreview) {
      onPreview({ src: rawPath, alt: title });
      return;
    }

    setIsOpening(true);
    try {
      await openProtectedDocument(rawPath);
    } catch (error) {
      toast.error(error.message || "Could not open this prescription document.");
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white text-[#155dfc]">
          <FileText className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-black text-slate-900">{title}</span>
          <span className="block text-xs font-semibold text-slate-500">
            {formatDisplayDate(document.createdAt)}
          </span>
        </span>
      </div>
      <div className="mt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleView}
          disabled={!rawPath || isOpening}
          className="h-8 w-full gap-1 text-xs"
        >
          {isOpening ? <Loader2 className="size-3 animate-spin" /> : <Eye className="size-3" />}
          {canPreview ? 'View image' : 'Open PDF'}
        </Button>
      </div>
    </div>
  );
}

function VaccinationRow({ vax }) {
  return (
    <div className="grid gap-3 border-b border-slate-100 px-4 py-4 text-sm last:border-b-0 dark:border-slate-800 md:grid-cols-[minmax(0,1.2fr)_0.9fr_0.9fr_1fr_0.8fr] md:items-center">
      <VaccinationCell label="Vaccine" value={vax.name || 'Unnamed vaccine'} strong />
      <VaccinationCell label="Date Given" value={formatDisplayDate(vax.date)} />
      <VaccinationCell label="Next Due" value={formatDisplayDate(vax.nextDue)} highlight />
      <VaccinationCell label="Veterinarian" value={vax.applicator || vax.veterinarianName || vax.veterinarian || 'N/A'} />
      <div className="flex items-center justify-between gap-3 md:block">
        <span className="text-xs font-black uppercase tracking-widest text-slate-400 md:hidden">Status</span>
        <Badge className={`w-fit border-0 ${
          vax.status === 'completed' ? 'bg-green-50 text-green-700 dark:bg-green-950/50 dark:text-green-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
        }`}>
          {vax.status || 'completed'}
        </Badge>
      </div>
    </div>
  );
}

function VaccinationCell({ label, value, strong = false, highlight = false }) {
  return (
    <div className="flex items-start justify-between gap-3 md:block">
      <span className="shrink-0 text-xs font-black uppercase tracking-widest text-slate-400 md:hidden">{label}</span>
      <span className={`min-w-0 break-words text-right md:text-left ${strong ? 'font-black text-slate-900 dark:text-white' : 'font-semibold'} ${highlight ? 'text-[#155dfc] dark:text-blue-300' : 'text-slate-700 dark:text-slate-200'}`}>
        {value || 'N/A'}
      </span>
    </div>
  );
}

function PetInfoRow({ label, value, highlight = false }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <span className={`break-words text-sm font-bold sm:text-right ${highlight ? 'text-[#155dfc]' : 'text-slate-900'}`}>
        {value}
      </span>
    </div>
  );
}
