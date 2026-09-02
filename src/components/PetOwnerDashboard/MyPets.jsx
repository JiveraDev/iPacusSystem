import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "../dashboardRouter.jsx";
import { Card, CardContent } from "../../ui/card";
import { Button } from "../../ui/button";
import { AlertCircle, Archive, CheckCircle2, ChevronRight, LayoutGrid, List, Loader2, PawPrint, Plus, RotateCcw, Search, ShieldCheck, Stethoscope, UserPlus, XCircle } from "lucide-react";
import { Input } from "../../ui/input";
import { Badge } from "../../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { decideCoparentRequest, fetchCoparentRequest, getUserPetsService } from "../../services/ConnectOwnership";
import { toast } from "../../reusecomponent/toast.jsx";
import { calculateAge } from "../../lib/date";
import { useAutoRefresh } from "../../hooks/useAutoRefresh";
import { fetchAllPets, searchPetDirectory, updatePetStatus } from "../../services/petService";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import ProtectedImage from "../shared/ProtectedImage.jsx";
import DashboardPageHeader from "../shared/DashboardPageHeader.jsx";

const DIRECTORY_ROLES = ["Admin", "Super Admin", "Veterinarian"];
const MEDICAL_SEARCH_FOCUS_KEY = "ipawcus-medical-search-focus";
const PET_CARD_ACCENTS = ["blue", "coral", "sun", "mint"];

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

function petCardHoverKind(pet) {
  const species = normalize(pet?.species);

  if (species.includes("cat") || species.includes("feline")) return "cat";
  if (species.includes("rabbit") || species.includes("bunny")) return "bunny";
  if (species.includes("bird") || species.includes("parrot") || species.includes("avian")) return "parrot";
  return "dog";
}

function petCardHoverAccent(pet) {
  const seed = String(petKey(pet) || "pet");
  const hash = Array.from(seed).reduce((total, character) => total + character.charCodeAt(0), 0);
  return PET_CARD_ACCENTS[hash % PET_CARD_ACCENTS.length];
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
  const [archiveFilter, setArchiveFilter] = useState("all");
  const [clinicalSearchResults, setClinicalSearchResults] = useState([]);
  const [isClinicalSearchLoading, setIsClinicalSearchLoading] = useState(false);
  const [clinicalSearchError, setClinicalSearchError] = useState("");
  const [coparentRequest, setCoparentRequest] = useState(null);
  const [isCoparentModalOpen, setIsCoparentModalOpen] = useState(false);
  const [isCoparentLoading, setIsCoparentLoading] = useState(false);
  const [coparentAction, setCoparentAction] = useState("");

  const currentUser = useMemo(() => JSON.parse(localStorage.getItem("currentUser") || "{}"), []);
  const currentUserId = Number(currentUser.id || currentUser.user_id || currentUser.userId || 0);
  const canManageArchives = ["admin", "super admin", "super_admin", "superadmin"].includes(normalize(currentUser.role));

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
        userPets = await fetchAllPets({ includeArchived: archiveFilter !== "active" });
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

  useAutoRefresh(fetchPets, { refreshKey: `pet-directory-${archiveFilter}` });

  useEffect(() => {
    const query = directorySearch.trim();
    if (!isAdminView || query.length < 2) {
      setClinicalSearchResults([]);
      setClinicalSearchError("");
      setIsClinicalSearchLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setClinicalSearchResults([]);
    setClinicalSearchError("");
    setIsClinicalSearchLoading(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const data = await searchPetDirectory(query, { signal: controller.signal, includeArchived: archiveFilter !== "active" });
        setClinicalSearchResults(Array.isArray(data) ? data : []);
      } catch (error) {
        if (controller.signal.aborted) return;
        setClinicalSearchError(error.message || "Pet health search is temporarily unavailable.");
      } finally {
        if (!controller.signal.aborted) {
          setIsClinicalSearchLoading(false);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [archiveFilter, directorySearch, isAdminView]);

  const hasClinicalSearch = isAdminView && directorySearch.trim().length >= 2;

  const filteredPets = useMemo(() => {
    if (!isAdminView) return pets;

    const statusPets = pets.filter((pet) => (
      archiveFilter === "all"
        || (archiveFilter === "archived" ? pet.isArchived : !pet.isArchived)
    ));

    const query = normalize(directorySearch);
    if (!query) return statusPets;
    if (query.length >= 2) {
      return clinicalSearchResults.filter((pet) => (
        archiveFilter === "all"
          || (archiveFilter === "archived" ? pet.isArchived : !pet.isArchived)
      ));
    }

    return statusPets.filter(pet => {
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
  }, [archiveFilter, clinicalSearchResults, directorySearch, isAdminView, pets]);

  const togglePetArchive = async (pet) => {
    const nextArchived = !pet.isArchived;
    try {
      const response = await updatePetStatus(pet.id || pet.db_id, {
        action: nextArchived ? "archive" : "restore",
        isArchived: nextArchived,
      });
      setPets((current) => current.map((item) => (
        petKey(item) === petKey(pet) ? { ...item, isArchived: nextArchived } : item
      )));
      toast.success(response.message || (nextArchived ? "Pet archived." : "Pet restored."));
    } catch (error) {
      toast.error(error.message || "Pet archive status could not be updated.");
    }
  };

  const openPet = (pet) => {
    navigate(`/dashboard/my-pets/${pet.id || pet.db_id}`);
  };

  const openSearchMatch = (pet, match) => {
    if (!match || match.targetType === "profile") {
      openPet(pet);
      return;
    }

    try {
      sessionStorage.setItem(MEDICAL_SEARCH_FOCUS_KEY, JSON.stringify({
        petDbId: Number(pet.db_id || 0),
        petCode: pet.id || "",
        query: directorySearch.trim(),
        match,
        expiresAt: Date.now() + 30_000
      }));
    } catch {
      // Navigation still works when browser storage is unavailable.
    }

    navigate(`/dashboard/my-pets/${pet.id || pet.db_id}/medical-records`);
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
      <DashboardPageHeader
        icon={PawPrint}
        title={isAdminView ? "Pet Directory" : "My Pets"}
        description={isAdminView
          ? "Search registered pets, owners, and linked clinical history."
          : "Review your linked pets and open their health information."}
      />

      {isAdminView && (
        <div className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="w-full lg:max-w-xl">
              <Input
                value={directorySearch}
                onChange={(event) => setDirectorySearch(event.target.value)}
                placeholder="Search pets or clinic ID"
                className="h-10"
                leftIcon={<Search className="size-4" />}
                rightIcon={isClinicalSearchLoading ? <Loader2 className="size-4 animate-spin text-[#155dfc]" /> : null}
              />
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Select value={archiveFilter} onValueChange={setArchiveFilter}>
                <SelectTrigger className="h-10 min-w-40 bg-white"><SelectValue placeholder="Pet status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All pets</SelectItem>
                  <SelectItem value="active">Active pets</SelectItem>
                  <SelectItem value="archived">Archived pets</SelectItem>
                </SelectContent>
              </Select>
            {!hasClinicalSearch && <div className="flex w-full gap-2 rounded-[12px] border border-slate-200 bg-slate-50 p-1 sm:w-auto">
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
            </div>}
            </div>
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-500">
            {hasClinicalSearch
              ? `${filteredPets.length} pet${filteredPets.length === 1 ? "" : "s"} matched this search`
              : `Showing ${filteredPets.length} of ${pets.length} registered pets`}
          </p>
        </div>
      )}

      {pets.length === 0 ? (
        <EmptyPetsState isAdminView={isAdminView} navigate={navigate} />
      ) : hasClinicalSearch && clinicalSearchError ? (
        <DirectorySearchError message={clinicalSearchError} />
      ) : hasClinicalSearch && isClinicalSearchLoading ? (
        <DirectorySearchLoading />
      ) : hasClinicalSearch && filteredPets.length > 0 ? (
        <PetClinicalSearchResults
          pets={filteredPets}
          query={directorySearch.trim()}
          onOpenPet={openPet}
          onOpenMatch={openSearchMatch}
        />
      ) : isAdminView && filteredPets.length === 0 ? (
        <NoDirectoryMatches clinical={hasClinicalSearch} />
      ) : isAdminView && directoryView === "list" ? (
        <PetDirectoryTable pets={filteredPets} onOpenPet={openPet} canManageArchives={canManageArchives} onToggleArchive={togglePetArchive} />
      ) : (
        <div className={isAdminView ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" : "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8"}>
          {filteredPets.map((pet) => (
            <PetCard key={petKey(pet)} pet={pet} compact={isAdminView} onOpen={() => openPet(pet)} canManageArchives={canManageArchives} onToggleArchive={() => togglePetArchive(pet)} />
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

function DirectorySearchLoading() {
  return (
    <Card className="border-slate-200">
      <CardContent className="flex min-h-40 items-center justify-center gap-3 py-10 text-slate-500">
        <Loader2 className="size-5 animate-spin text-[#155dfc]" />
        <p className="text-sm font-semibold">Searching pet profiles and medical history...</p>
      </CardContent>
    </Card>
  );
}

function DirectorySearchError({ message }) {
  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardContent className="flex min-h-32 items-center justify-center gap-3 py-8 text-amber-800">
        <AlertCircle className="size-5 shrink-0" />
        <p className="text-sm font-semibold">{message}</p>
      </CardContent>
    </Card>
  );
}

function HighlightedText({ text, query }) {
  const source = String(text || "");
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) return source;

  const lowerSource = source.toLowerCase();
  const lowerQuery = normalizedQuery.toLowerCase();
  const parts = [];
  let cursor = 0;
  let matchIndex = lowerSource.indexOf(lowerQuery);

  while (matchIndex !== -1) {
    if (matchIndex > cursor) {
      parts.push(source.slice(cursor, matchIndex));
    }
    parts.push(
      <mark key={`${matchIndex}-${parts.length}`} className="rounded bg-amber-100 px-0.5 font-bold text-inherit">
        {source.slice(matchIndex, matchIndex + normalizedQuery.length)}
      </mark>
    );
    cursor = matchIndex + normalizedQuery.length;
    matchIndex = lowerSource.indexOf(lowerQuery, cursor);
  }

  if (cursor < source.length) {
    parts.push(source.slice(cursor));
  }

  return parts.length > 0 ? parts : source;
}

function PetClinicalSearchResults({ pets, query, onOpenPet, onOpenMatch }) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-sm" aria-label="Pet health search results">
      <div className="divide-y divide-slate-100">
        {pets.map((pet) => (
          <article key={petKey(pet)} className="p-4 sm:p-5">
            <button
              type="button"
              onClick={() => onOpenPet(pet)}
              className="flex w-full items-center gap-3 rounded-lg text-left outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#155dfc] focus-visible:ring-offset-2"
            >
              {pet.profileImage ? (
                <ProtectedImage
                  src={pet.profileImage}
                  alt={pet.name}
                  className="size-11 shrink-0 rounded-full border border-slate-200 object-cover"
                  fallbackClassName="size-11 shrink-0 rounded-full border border-slate-200"
                />
              ) : (
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#155dfc]">
                  <PawPrint className="size-5" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-black text-slate-950">{pet.name}</span>
                <span className="block truncate text-xs font-semibold text-slate-500">
                  {[petType(pet), pet.ownerName || pet.tempOwnerName, pet.id].filter(Boolean).join(" | ")}
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-slate-400" />
            </button>

            <div className="ml-0 mt-3 space-y-1.5 sm:ml-14">
              {Array.isArray(pet.searchMatches) && pet.searchMatches.map((match) => (
                <button
                  type="button"
                  key={match.id}
                  onClick={() => onOpenMatch(pet, match)}
                  className="group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left outline-none transition-colors hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-[#155dfc]"
                >
                  <Stethoscope className="mt-0.5 size-4 shrink-0 text-[#155dfc]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-black uppercase tracking-wide text-slate-500">{match.category}</span>
                    <span className="mt-0.5 block text-sm font-medium leading-5 text-slate-700">
                      <HighlightedText text={match.text} query={query} />
                    </span>
                  </span>
                  <ChevronRight className="mt-2 size-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#155dfc]" />
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function NoDirectoryMatches({ clinical = false }) {
  return (
    <Card className="border-2 border-dashed border-slate-200 bg-slate-50/50">
      <CardContent className="py-10 text-center">
        <PawPrint className="mx-auto mb-3 size-10 text-slate-300" />
        <h3 className="mb-1 text-lg font-bold text-slate-900">No matching pets found</h3>
        <p className="text-sm font-medium text-slate-500">
          {clinical
            ? "Try another pet, owner, diagnosis, symptom, allergy, or clinic ID."
            : "Try another pet name, owner, species, breed, status, or clinic ID."}
        </p>
      </CardContent>
    </Card>
  );
}

function PetDirectoryTable({ pets, onOpenPet, canManageArchives, onToggleArchive }) {
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
            {canManageArchives && <TableHead className="w-28 text-right">Action</TableHead>}
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
                <p className="truncate font-semibold text-slate-700">{pet.ownerName || pet.tempOwnerName || "N/A"}</p>
              </TableCell>
              <TableCell className="hidden min-w-0 px-2 xl:table-cell sm:px-3">
                <span className="inline-flex max-w-full rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-bold text-slate-700">
                  <span className="truncate">{pet.id || "N/A"}</span>
                </span>
              </TableCell>
              <TableCell className="min-w-0 px-2 sm:px-3">
                {pet.isArchived ? <Badge className="border-0 bg-slate-100 text-slate-600">Archived</Badge> : <StatusBadge status={pet.status} />}
              </TableCell>
              {canManageArchives && (
                <TableCell className="text-right">
                  <Button type="button" variant="outline" size="sm" onClick={(event) => { event.stopPropagation(); onToggleArchive(pet); }}>
                    {pet.isArchived ? <RotateCcw className="mr-2 size-4" /> : <Archive className="mr-2 size-4" />}
                    {pet.isArchived ? "Restore" : "Archive"}
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PetCard({ pet, compact, onOpen, canManageArchives = false, onToggleArchive }) {
  return (
    <Card
      petHover="always"
      petKind={petCardHoverKind(pet)}
      petAccent={petCardHoverAccent(pet)}
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
          {pet.isArchived && <Badge className="mt-2 border-0 bg-slate-100 text-slate-600">Archived</Badge>}
          {compact && canManageArchives && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={(event) => { event.stopPropagation(); onToggleArchive?.(); }}
            >
              {pet.isArchived ? <RotateCcw className="mr-2 size-4" /> : <Archive className="mr-2 size-4" />}
              {pet.isArchived ? "Restore" : "Archive"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LinkPetCard({ navigate }) {
  return (
    <Card
      petHover="always"
      petKind="bunny"
      petAccent="sun"
      className="group flex min-h-[300px] cursor-pointer flex-col justify-center overflow-hidden border-2 border-dashed border-slate-200 bg-slate-50/30 transition-all hover:border-[#155dfc] hover:bg-blue-50/30"
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
