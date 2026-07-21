import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "../dashboardRouter.jsx";
import { Card, CardContent } from "../../ui/card";
import { Button } from "../../ui/button";
import { CheckCircle2, LayoutGrid, List, Loader2, PawPrint, Plus, Search, ShieldCheck, UserPlus, XCircle } from "lucide-react";
import { Input } from "../../ui/input";
import { Badge } from "../../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { decideCoparentRequest, fetchCoparentRequest, getUserPetsService } from "../../services/ConnectOwnership";
import { toast } from "../../reusecomponent/toast.jsx";
import { calculateAge } from "../../lib/date";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { fetchAllPets } from "../../services/petService";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import ProtectedImage from "../shared/ProtectedImage.jsx";

const DIRECTORY_ROLES = ["Admin", "Super Admin", "Veterinarian"];

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function petKey(pet) {
  return pet.db_id || pet.id || pet.pet_id || pet.pet_sharable_ID || pet.name;
}

function petAge(pet) {
  return calculateAge(pet.birthDate) || pet.age || "N/A";
}

function petType(pet) {
  return [pet.species, pet.breed].filter(Boolean).join(" - ") || "No type details";
}

function getStatusTone(status) {
  if (status === "Healthy") return "bg-green-50 text-green-700";
  if (status === "Emergency") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
}

function StatusBadge({ status }) {
  if (!status) {
    return <Badge className="border-0 bg-slate-100 text-slate-600"><span className="truncate">N/A</span></Badge>;
  }

  return <Badge className={`border-0 ${getStatusTone(status)}`}><span className="truncate">{status}</span></Badge>;
}

export default function MyPets() {
  const navigate = useNavigate();
  const [pets, setPets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdminView, setIsAdminView] = useState(false);
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryView, setDirectoryView] = useState("card");
  const [coparentRequest, setCoparentRequest] = useState(null);
  const [isCoparentModalOpen, setIsCoparentModalOpen] = useState(false);
  const [isCoparentLoading, setIsCoparentLoading] = useState(false);
  const [coparentAction, setCoparentAction] = useState("");

  const currentUser = useMemo(() => JSON.parse(localStorage.getItem("currentUser") || "{}"), []);
  const currentUserId = Number(currentUser.id || currentUser.user_id || currentUser.userId || 0);

  const openCoparentRequest = async (requestId) => {
    if (!requestId) return;

    setIsCoparentLoading(true);
    setIsCoparentModalOpen(true);

    try {
      const request = await fetchCoparentRequest(requestId);
      setCoparentRequest(request);
    } catch (error) {
      toast.error(error.message || "Co-parent request could not be loaded.");
      setIsCoparentModalOpen(false);
    } finally {
      setIsCoparentLoading(false);
    }
  };

  useEffect(() => {
    let requestId = "";

    try {
      const params = new URLSearchParams(window.location.search);
      requestId = params.get("coparentRequest") || "";

      if (requestId) {
        window.history.replaceState({}, "", window.location.pathname);
      }

      if (!requestId) {
        requestId = sessionStorage.getItem("coparent-request-id") || "";
        sessionStorage.removeItem("coparent-request-id");
      }
    } catch {
      requestId = "";
    }

    if (requestId) {
      openCoparentRequest(requestId);
    }
  }, []);

  const handleCoparentDecision = async (action) => {
    if (!coparentRequest?.requestId) return;

    setCoparentAction(action);

    try {
      const result = await decideCoparentRequest(coparentRequest.requestId, action);
      setCoparentRequest(result.request);
      toast.success(result.message || "Co-parent request updated.");
    } catch (error) {
      toast.error(error.message || "Co-parent request could not be updated.");
    } finally {
      setCoparentAction("");
    }
  };

  const fetchPets = async ({ isAutoRefresh = false } = {}) => {
    try {
      const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      const userId = currentUser.id || currentUser.user_id || currentUser.userId;
      const userRole = currentUser.role || "";
      const isDirectoryUser = DIRECTORY_ROLES.includes(userRole);
      setIsAdminView(isDirectoryUser);

      if (!userId) {
        if (!isAutoRefresh) {
          toast.error("User session not found. Please log in again.");
        }
        setIsLoading(false);
        return;
      }

      let userPets = [];
      if (isDirectoryUser) {
        userPets = await fetchAllPets();
      } else {
        userPets = await getUserPetsService(userId);
      }

      const standardizedPets = userPets.map(pet => ({
        ...pet,
        name: pet.name || pet.petName || "Unnamed Pet"
      }));

      setPets(standardizedPets);
    } catch (error) {
      console.error("Failed to fetch pets:", error);
      if (!isAutoRefresh) {
        toast.error("Failed to load pets");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useAutoRefresh(fetchPets);

  const filteredPets = useMemo(() => {
    if (!isAdminView) return pets;

    const query = normalize(directorySearch);
    if (!query) return pets;

    return pets.filter(pet => {
      const searchableText = [
        pet.name,
        pet.id,
        pet.db_id,
        pet.species,
        pet.breed,
        pet.gender,
        pet.status,
        pet.tempOwnerName
      ].join(" ");

      return normalize(searchableText).includes(query);
    });
  }, [directorySearch, isAdminView, pets]);

  const openPet = (pet) => {
    navigate(`/dashboard/my-pets/${pet.id}`);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <Loader2 className="mb-4 h-12 w-12 animate-spin text-[#155dfc]" />
        <p className="font-medium text-gray-600">{isAdminView ? "Loading pet directory..." : "Loading your pets..."}</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in space-y-6 duration-500 lg:space-y-8">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          {isAdminView ? "Pet Directory" : "My Pets"}
        </h1>
      </div>

      {isAdminView && (
        <div className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="w-full lg:max-w-xl">
              <Input
                value={directorySearch}
                onChange={(event) => setDirectorySearch(event.target.value)}
                placeholder="Search pet, owner, species, breed, status, or clinic ID"
                className="h-10"
                leftIcon={<Search className="size-4" />}
              />
            </div>
            <div className="flex w-full gap-2 rounded-[12px] border border-slate-200 bg-slate-50 p-1 sm:w-auto">
              <Button
                type="button"
                variant={directoryView === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setDirectoryView("list")}
                className={`flex-1 sm:flex-none ${directoryView === "list" ? "bg-[#155dfc]" : ""}`}
              >
                <List className="mr-2 size-4" />
                List
              </Button>
              <Button
                type="button"
                variant={directoryView === "card" ? "default" : "ghost"}
                size="sm"
                onClick={() => setDirectoryView("card")}
                className={`flex-1 sm:flex-none ${directoryView === "card" ? "bg-[#155dfc]" : ""}`}
              >
                <LayoutGrid className="mr-2 size-4" />
                Card
              </Button>
            </div>
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-500">
            Showing {filteredPets.length} of {pets.length} registered pets
          </p>
        </div>
      )}

      {pets.length === 0 ? (
        <EmptyPetsState isAdminView={isAdminView} navigate={navigate} />
      ) : isAdminView && filteredPets.length === 0 ? (
        <NoDirectoryMatches />
      ) : isAdminView && directoryView === "list" ? (
        <PetDirectoryTable pets={filteredPets} onOpenPet={openPet} />
      ) : (
        <div className={isAdminView ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" : "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8"}>
          {filteredPets.map((pet) => (
            <PetCard key={petKey(pet)} pet={pet} compact={isAdminView} onOpen={() => openPet(pet)} />
          ))}

          {!isAdminView && <LinkPetCard navigate={navigate} />}
        </div>
      )}

      <CoparentRequestDialog
        open={isCoparentModalOpen}
        onOpenChange={setIsCoparentModalOpen}
        request={coparentRequest}
        isLoading={isCoparentLoading}
        action={coparentAction}
        currentUserId={currentUserId}
        onApprove={() => handleCoparentDecision("approve")}
        onDecline={() => handleCoparentDecision("decline")}
        onCancel={() => handleCoparentDecision("cancel")}
      />
    </div>
  );
}

function CoparentRequestDialog({
  open,
  onOpenChange,
  request,
  isLoading,
  action,
  currentUserId,
  onApprove,
  onDecline,
  onCancel
}) {
  const isPending = request?.status === "pending";
  const isPrimaryOwner = Number(request?.primaryOwnerUserId || 0) === Number(currentUserId || 0);
  const isRequester = Number(request?.requesterUserId || 0) === Number(currentUserId || 0);
  const showRequesterActions = isPending && isRequester && !isPrimaryOwner;
  const showPrimaryOwnerActions = isPending && isPrimaryOwner;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-[#155dfc]" />
            Co-parent request
          </DialogTitle>
          <DialogDescription>
            Review the request before giving another owner access to this pet.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center">
            <Loader2 className="size-8 animate-spin text-[#155dfc]" />
          </div>
        ) : request ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Pet</p>
                  <p className="truncate text-lg font-black text-slate-950">{request.petName}</p>
                  <p className="truncate text-sm font-semibold text-slate-500">
                    {[request.petSpecies, request.petBreed].filter(Boolean).join(" - ") || request.petCode || "Registered pet"}
                  </p>
                </div>
                <Badge className={request.status === "pending" ? "bg-amber-50 text-amber-700" : request.status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}>
                  {request.status}
                </Badge>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Requester</p>
                <p className="truncate font-bold text-slate-900">{request.requesterName}</p>
                <p className="truncate text-xs font-semibold text-slate-500">{request.requesterEmail}</p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Primary owner</p>
                <p className="truncate font-bold text-slate-900">{request.primaryOwnerName}</p>
                <p className="truncate text-xs font-semibold text-slate-500">{request.primaryOwnerEmail}</p>
              </div>
            </div>

            {isPending ? (
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm font-semibold text-blue-800">
                <ShieldCheck className="mr-2 inline size-4" />
                Approving this request will link the requester as a co-parent. The primary owner will stay unchanged.
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-600">
                This request is already {request.status}.
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
            Co-parent request details are not available.
          </div>
        )}

        {(showRequesterActions || showPrimaryOwnerActions) && (
          <DialogFooter>
          {showRequesterActions && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={Boolean(action)}>
              {action === "cancel" ? <Loader2 className="animate-spin" /> : <XCircle />}
              Cancel Request
            </Button>
          )}
          {showPrimaryOwnerActions && (
            <>
              <Button type="button" variant="outline" onClick={onDecline} disabled={Boolean(action)}>
                {action === "decline" ? <Loader2 className="animate-spin" /> : <XCircle />}
                Decline
              </Button>
              <Button type="button" onClick={onApprove} disabled={Boolean(action)} className="bg-[#155dfc] hover:bg-blue-700">
                {action === "approve" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                Approve Co-parent
              </Button>
            </>
          )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EmptyPetsState({ isAdminView, navigate }) {
  return (
    <Card className="border-2 border-dashed border-slate-200 bg-slate-50/50">
      <CardContent className="pb-10 pt-10 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm">
          <PawPrint className="h-10 w-10 text-slate-300" />
        </div>
        <h3 className="mb-2 text-xl font-bold text-slate-900">
          {isAdminView ? "No registered pets found" : "No Pets Linked Yet"}
        </h3>
        <p className="mx-auto mb-8 max-w-sm text-slate-500">
          {isAdminView
            ? "There are currently no pets in the system record. Go to Pet Register to add one."
            : "Link your first pet using the unique Registration ID provided by your clinic."}
        </p>
        {!isAdminView && (
          <Button
            onClick={() => navigate("/dashboard/my-pets/add")}
            className="h-12 bg-[#155dfc] px-8 text-base font-semibold hover:bg-blue-700"
          >
            <Plus className="mr-2 h-5 w-5" />
            Link Your First Pet
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function NoDirectoryMatches() {
  return (
    <Card className="border-2 border-dashed border-slate-200 bg-slate-50/50">
      <CardContent className="py-10 text-center">
        <PawPrint className="mx-auto mb-3 size-10 text-slate-300" />
        <h3 className="mb-1 text-lg font-bold text-slate-900">No matching pets found</h3>
        <p className="text-sm font-medium text-slate-500">Try another pet name, owner, species, breed, status, or clinic ID.</p>
      </CardContent>
    </Card>
  );
}

function PetDirectoryTable({ pets, onOpenPet }) {
  return (
    <div className="rounded-[14px] border border-slate-200 bg-white shadow-sm">
      <Table className="w-full min-w-0 table-fixed text-xs sm:text-sm">
        <TableHeader className="bg-slate-50/80">
          <TableRow>
            <TableHead className="w-[64%] px-2 font-bold text-slate-700 sm:w-[62%] md:w-[48%] lg:w-[34%] xl:w-[26%] sm:px-3">Pet</TableHead>
            <TableHead className="hidden w-[24%] px-2 font-bold text-slate-700 md:table-cell lg:w-[18%] xl:w-[15%] sm:px-3">Age / Sex</TableHead>
            <TableHead className="hidden w-[30%] px-2 font-bold text-slate-700 lg:table-cell xl:w-[22%] sm:px-3">Owner</TableHead>
            <TableHead className="hidden w-[22%] px-2 font-bold text-slate-700 xl:table-cell sm:px-3">Clinic ID</TableHead>
            <TableHead className="w-[36%] px-2 font-bold text-slate-700 sm:w-[38%] md:w-[28%] lg:w-[18%] xl:w-[15%] sm:px-3">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pets.map((pet) => (
            <TableRow key={petKey(pet)} className="cursor-pointer" onClick={() => onOpenPet(pet)}>
              <TableCell className="min-w-0 px-2 sm:px-3">
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  {pet.profileImage ? (
                    <ProtectedImage
                      src={pet.profileImage}
                      alt={pet.name}
                      className="size-8 shrink-0 rounded-full border border-slate-200 object-cover sm:size-10"
                      fallbackClassName="size-8 shrink-0 rounded-full border border-slate-200 sm:size-10"
                    />
                  ) : (
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#155dfc] sm:size-10">
                      <PawPrint className="size-4 sm:size-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900">{pet.name}</p>
                    <p className="truncate text-xs font-medium text-slate-500">{petType(pet)}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden min-w-0 px-2 md:table-cell sm:px-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-700">{petAge(pet)}</p>
                  <p className="truncate text-xs font-medium text-slate-500">{pet.gender || "N/A"}</p>
                </div>
              </TableCell>
              <TableCell className="hidden min-w-0 px-2 lg:table-cell sm:px-3">
                <p className="truncate font-semibold text-slate-700">{pet.tempOwnerName || "N/A"}</p>
              </TableCell>
              <TableCell className="hidden min-w-0 px-2 xl:table-cell sm:px-3">
                <span className="inline-flex max-w-full rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-bold text-slate-700">
                  <span className="truncate">{pet.id || "N/A"}</span>
                </span>
              </TableCell>
              <TableCell className="min-w-0 px-2 sm:px-3"><StatusBadge status={pet.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PetCard({ pet, compact, onOpen }) {
  return (
    <Card
      className={`group min-w-0 cursor-pointer overflow-hidden border-slate-200 transition-all duration-300 hover:-translate-y-1 hover:border-[#155dfc] hover:shadow-xl ${compact ? "rounded-[12px]" : ""}`}
      onClick={onOpen}
    >
      <CardContent className={compact ? "min-w-0 p-4" : "min-w-0 pt-8"}>
        <div className="min-w-0 text-center">
          <div className={compact ? "relative mb-3 inline-block" : "relative mb-6 inline-block"}>
            {pet.profileImage ? (
              <ProtectedImage
                src={pet.profileImage}
                alt={pet.name}
                className={`${compact ? "h-20 w-20" : "h-32 w-32"} mx-auto rounded-full border-4 border-white object-cover shadow-md transition-transform duration-300 group-hover:scale-105`}
                fallbackClassName={`${compact ? "h-20 w-20" : "h-32 w-32"} mx-auto rounded-full border-4 border-white shadow-md`}
              />
            ) : (
              <div className={`${compact ? "h-20 w-20" : "h-32 w-32"} mx-auto flex items-center justify-center rounded-full bg-gradient-to-br from-[#155dfc] to-blue-600 shadow-md`}>
                <PawPrint className={`${compact ? "h-9 w-9" : "h-14 w-14"} text-white opacity-90`} />
              </div>
            )}

            {pet.status && (
              <span
                className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white ${
                  pet.status === "Healthy"
                    ? "bg-green-500"
                    : pet.status === "Emergency"
                      ? "animate-pulse bg-red-500"
                      : "bg-amber-500"
                }`}
              />
            )}
          </div>

          <h3 className={`${compact ? "text-lg" : "text-xl"} mx-auto mb-1 max-w-full truncate px-1 font-extrabold text-slate-900 transition-colors group-hover:text-[#155dfc]`}>
            {pet.name}
          </h3>
          <p className={`${compact ? "mb-2 text-sm" : "mb-3"} mx-auto max-w-full truncate px-1 font-medium text-slate-500`}>{petType(pet)}</p>

          {compact && pet.status && (
            <div className="mb-3 inline-block max-w-full rounded-full border border-slate-100 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider shadow-sm">
              <span
                className={`block truncate ${
                  pet.status === "Healthy"
                    ? "text-green-600"
                    : pet.status === "Emergency"
                      ? "text-red-600"
                      : "text-amber-600"
                }`}
              >
                {pet.status}
              </span>
            </div>
          )}

          <div className={`${compact ? "mb-3 text-xs" : "mb-4 text-sm"} flex min-w-0 items-center justify-center gap-2 overflow-hidden px-1 font-medium text-slate-400`}>
            <span className="min-w-0 truncate">{petAge(pet)}</span>
            <span className="shrink-0 text-slate-200">|</span>
            <span className="min-w-0 truncate">{pet.gender || "N/A"}</span>
          </div>

          {compact && (
            <p className="-mt-2 mb-3 max-w-full truncate px-1 text-xs font-semibold text-slate-400">
              ID: {pet.id || "N/A"}
            </p>
          )}

          {!compact && pet.status && (
            <div className="inline-block max-w-full rounded-full border border-slate-100 bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider shadow-sm">
              <span
                className={`block truncate ${
                  pet.status === "Healthy"
                    ? "text-green-600"
                    : pet.status === "Emergency"
                      ? "text-red-600"
                      : "text-amber-600"
                }`}
              >
                {pet.status}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LinkPetCard({ navigate }) {
  return (
    <Card
      className="group flex min-h-[300px] cursor-pointer flex-col justify-center border-2 border-dashed border-slate-200 bg-slate-50/30 transition-all hover:border-[#155dfc] hover:bg-blue-50/30"
      onClick={() => navigate("/dashboard/my-pets/add")}
    >
      <CardContent className="flex items-center justify-center pt-0">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm transition-transform group-hover:scale-110">
            <Plus className="h-10 w-10 text-slate-300 group-hover:text-[#155dfc]" />
          </div>
          <h3 className="text-lg font-bold text-slate-700 group-hover:text-[#155dfc]">Link New Pet</h3>
          <p className="mt-1 text-sm text-slate-400">Register another clinic ID</p>
        </div>
      </CardContent>
    </Card>
  );
}
