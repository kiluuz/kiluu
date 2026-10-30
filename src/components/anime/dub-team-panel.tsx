"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, MessageSquare, Mic2, Plus, Search, ShieldCheck, Trash2, UserPlus, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore } from "./store";
import { useI18n } from "@/components/i18n-provider";
import { SmartImage } from "./ui-bits";
import { toast } from "sonner";
import {
  DUB_ROLES,
  dubErrorText,
  dubTeamTitle,
  type DubRole,
  type DubTitleKey,
} from "@/lib/dub-team-shared";

const MIN_SITE_MEMBERS = 3;

interface TeamSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  reputation: number;
  verified: boolean;
  status: string;
  animeCount: number;
  linkedMemberCount: number;
  _count: { members: number; credits: number };
}

interface TeamDetail extends Omit<TeamSummary, "_count" | "animeCount"> {
  title: { key: DubTitleKey; color: string };
  rating: number | null;
  ratingCount: number;
  chatRoomId: string | null;
  clubId?: string | null;
  invites: {
    id: string;
    createdAt: string;
    user: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  }[];
  members: {
    id: string;
    name: string;
    role: string;
    userId: string | null;
    user: { username: string; displayName: string | null; avatarUrl: string | null } | null;
  }[];
  credits: {
    id: string;
    language: string;
    speakerCount: number;
    createdAt: string;
    anime: { id: string; slug: string; title: string; coverImage: string | null };
    cast: { id: string; speakerName: string; character: string }[];
    rating: number | null;
    ratingCount: number;
  }[];
}

class DubApiError extends Error {
  readonly code: unknown;
  constructor(message: string, code: unknown) {
    super(message);
    this.code = code;
  }
}

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new DubApiError(typeof data?.error === "string" ? data.error : `Request failed (${response.status})`, data?.code);
  }
  return data as Record<string, unknown>;
}

export function DubTeamPanel() {
  const { user, navigate } = useAppStore();
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [teamName, setTeamName] = useState("");
  const [teamAbout, setTeamAbout] = useState("");
  const [creating, setCreating] = useState(false);

  const [memberName, setMemberName] = useState("");
  const [memberRole, setMemberRole] = useState<DubRole>("voice");
  const [addingMember, setAddingMember] = useState(false);

  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<
    { id: string; username: string; displayName: string | null; avatarUrl: string | null }[]
  >([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [removingCreditId, setRemovingCreditId] = useState<string | null>(null);
  const [confirmCreditId, setConfirmCreditId] = useState<string | null>(null);

  const mineQuery = useQuery({
    queryKey: ["dub-teams", "mine", user?.id ?? "anonymous"],
    queryFn: async () => {
      const data = await api("/api/dub-teams?mine=1");
      return (data.teams as TeamSummary[] | undefined) ?? [];
    },
    enabled: Boolean(user && user.role === "CREATOR"),
    staleTime: 60_000,
    retry: false,
  });

  const team = mineQuery.data?.[0] ?? null;

  const detailQuery = useQuery({
    queryKey: ["dub-teams", "detail", team?.id ?? "none"],
    queryFn: async () => {
      const data = await api(`/api/dub-teams/${team?.id}`);
      return data.team as TeamDetail;
    },
    enabled: Boolean(team?.id),
    staleTime: 30_000,
    retry: false,
  });

  const detail = detailQuery.data ?? null;

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const query = userSearch.trim();
    if (query.length < 2) {
      searchTimer.current = setTimeout(() => {
        setUserResults([]);
        setSearchingUsers(false);
      }, 0);
    } else {
      searchTimer.current = setTimeout(async () => {
        setSearchingUsers(true);
        try {
          const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
          const data = await response.json().catch(() => ({}));
          setUserResults(
            Array.isArray(data.users)
              ? (data.users as { id: string; username: string; displayName: string | null; avatarUrl: string | null }[]).slice(0, 8)
              : []
          );
        } catch {
          setUserResults([]);
        } finally {
          setSearchingUsers(false);
        }
      }, 300);
    }
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [userSearch]);

  if (!user || user.role !== "CREATOR") return null;

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["dub-teams"] });
  }

  function fail(error: unknown, fallback: string) {
    toast.error(
      error instanceof DubApiError
        ? dubErrorText(t, error.code, error.message)
        : error instanceof Error
          ? error.message
          : fallback
    );
  }

  async function createTeam() {
    if (teamName.trim().length < 2) {
      toast.error(t("dub.error.INVALID_NAME"));
      return;
    }
    setCreating(true);
    try {
      await api("/api/dub-teams", {
        method: "POST",
        body: JSON.stringify({ name: teamName.trim(), description: teamAbout.trim() || null }),
      });
      setTeamName("");
      setTeamAbout("");
      toast.success(t("dub.teamCreated"));
      refresh();
    } catch (error) {
      fail(error, t("dub.teamCreateFailed"));
    } finally {
      setCreating(false);
    }
  }

  async function addMember() {
    if (!team) return;
    if (memberName.trim().length < 2) {
      toast.error(t("dub.error.INVALID_NAME"));
      return;
    }
    setAddingMember(true);
    try {
      await api(`/api/dub-teams/${team.id}/members`, {
        method: "POST",
        body: JSON.stringify({ name: memberName.trim(), role: memberRole }),
      });
      setMemberName("");
      toast.success(t("dub.memberAdded"));
      refresh();
    } catch (error) {
      fail(error, t("dub.memberAddFailed"));
    } finally {
      setAddingMember(false);
    }
  }

  async function inviteUser(userId: string) {
    if (!team) return;
    setInvitingUserId(userId);
    try {
      await api(`/api/dub-teams/${team.id}/members`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      toast.success(t("dub.inviteSent"));
      setUserSearch("");
      setUserResults([]);
      refresh();
    } catch (error) {
      fail(error, t("dub.inviteFailed"));
    } finally {
      setInvitingUserId(null);
    }
  }

  function openTeamChat() {
    const clubId = detail?.clubId;
    if (!clubId) {
      toast.error(t("dub.chatNeedMember"));
      return;
    }
    navigate("community", { filters: { club: clubId } });
  }

  async function removeMember(memberId: string) {
    if (!team) return;
    try {
      await api(`/api/dub-teams/${team.id}/members?memberId=${encodeURIComponent(memberId)}`, { method: "DELETE" });
      toast.success(t("dub.memberRemoved"));
      refresh();
    } catch (error) {
      fail(error, t("dub.memberRemoveFailed"));
    }
  }

  async function removeCredit(creditId: string) {
    if (!team) return;
    setRemovingCreditId(creditId);
    try {
      await api(`/api/dub-teams/${team.id}/credits?creditId=${encodeURIComponent(creditId)}`, { method: "DELETE" });
      toast.success(t("dub.creditRemoved"));
      setConfirmCreditId(null);
      refresh();
    } catch (error) {
      fail(error, t("dub.creditRemoveFailed"));
    } finally {
      setRemovingCreditId(null);
    }
  }

  const title = dubTeamTitle(detail?.reputation ?? team?.reputation ?? 0, detail?.verified ?? team?.verified ?? false);
  const linkedCount = detail?.linkedMemberCount ?? team?.linkedMemberCount ?? 0;
  const removeCreditTarget = (detail?.credits ?? []).find((credit) => credit.id === confirmCreditId) ?? null;

  return (
    <section className="glass rounded-2xl p-5 sm:p-6 mb-7 border border-primary/20">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Mic2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-bold">{t("dub.panelTitle")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("dub.panelDesc")}</p>
        </div>
      </div>

      {mineQuery.isPending ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t("dub.loading")}
        </div>
      ) : mineQuery.isError ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-600 dark:text-amber-400">
          {t("dub.loadError")}
        </p>
      ) : !team ? (
        <div className="rounded-xl border border-dashed p-4 space-y-3">
          <p className="font-semibold text-sm">{t("dub.noTeamTitle")}</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("dub.teamNameLabel")}</Label>
              <Input
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                maxLength={60}
                placeholder={t("dub.teamNamePlaceholder")}
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("dub.teamAboutLabel")}</Label>
              <Input
                value={teamAbout}
                onChange={(event) => setTeamAbout(event.target.value)}
                maxLength={200}
                placeholder={t("dub.teamAboutPlaceholder")}
                className="h-10 rounded-xl"
              />
            </div>
          </div>
          <Button
            type="button"
            onClick={createTeam}
            disabled={creating}
            className="rounded-xl brand-gradient text-white font-bold"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {t("dub.createTeam")}
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-black text-lg">{detail?.name ?? team.name}</p>
              <span
                className="text-[11px] font-bold rounded-full px-2.5 py-0.5 border"
                style={{ color: title.color, borderColor: `${title.color}55`, backgroundColor: `${title.color}14` }}
              >
                {t(`dub.title.${title.key}`)}
              </span>
              {(detail?.verified ?? team.verified) && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500">
                  <ShieldCheck className="w-3.5 h-3.5" /> {t("dub.verified")}
                </span>
              )}
            </div>
            {(detail?.description ?? team.description) && (
              <p className="text-sm text-muted-foreground mt-1">{detail?.description ?? team.description}</p>
            )}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">{t("dub.reputation")}</span>
                <span className="font-bold tabular-nums">{detail?.reputation ?? team.reputation} / 100</span>
              </div>
              <Progress value={detail?.reputation ?? team.reputation} className="h-2" />
              <p className="text-[11px] text-muted-foreground mt-2">
                {detail && detail.ratingCount > 0
                  ? t("dub.audienceRating", { rating: detail.rating ?? "—", count: detail.ratingCount, credits: detail.credits.length })
                  : t("dub.stats", { members: team._count.members, credits: team._count.credits })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Button type="button" size="sm" variant="secondary" onClick={openTeamChat} className="rounded-full font-bold">
                <MessageSquare className="w-3.5 h-3.5" /> {t("dub.teamChat")}
              </Button>
              <span
                className={
                  linkedCount >= MIN_SITE_MEMBERS
                    ? "inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500"
                    : "inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400"
                }
              >
                {linkedCount >= MIN_SITE_MEMBERS ? <Check className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                {t("dub.siteMembers", { count: linkedCount, min: MIN_SITE_MEMBERS })}
              </span>
            </div>
            {linkedCount < MIN_SITE_MEMBERS && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">
                {t("dub.teamGateHint", { min: MIN_SITE_MEMBERS })}
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-primary" />
              <p className="font-bold text-sm">{t("dub.membersTitle")}</p>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              {(detail?.members ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("dub.noMembers")}</p>
              ) : (
                detail?.members.map((member) => (
                  <span
                    key={member.id}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-muted/40 px-3 py-1 text-xs"
                  >
                    <span className="font-semibold">{member.name}</span>
                    {member.userId && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-500">
                        <Check className="w-3 h-3" /> {t("dub.linkedTag")}
                      </span>
                    )}
                    <span className="text-muted-foreground">
                      {(DUB_ROLES as readonly string[]).includes(member.role) ? t(`dub.role.${member.role}`) : member.role}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeMember(member.id)}
                      aria-label={t("dub.removeMember", { name: member.name })}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))
              )}
            </div>

            {(detail?.invites ?? []).length > 0 && (
              <div className="mb-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-2.5">
                <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mb-1.5">
                  {t("dub.invitesPending")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {detail?.invites.map((invite) => (
                    <span key={invite.id} className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-[11px]">
                      <span className="font-semibold">{invite.user.displayName || invite.user.username}</span>
                      <span className="text-muted-foreground">{t("dub.inviteSentLabel")}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border bg-muted/20 p-3 mb-3 space-y-2">
              <p className="text-xs font-bold flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-primary" /> {t("dub.inviteTitle")}
              </p>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder={t("dub.searchPlaceholder")}
                  className="h-9 rounded-xl pl-8"
                  maxLength={80}
                />
              </div>
              {userSearch.trim().length >= 2 && (
                <div className="max-h-44 overflow-y-auto fancy-scroll space-y-1">
                  {searchingUsers ? (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 px-1 py-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("dub.searching")}
                    </p>
                  ) : userResults.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground px-1 py-1.5">{t("dub.searchEmpty")}</p>
                  ) : (
                    userResults.map((candidate) => {
                      const alreadyMember = (detail?.members ?? []).some((member) => member.userId === candidate.id);
                      const alreadyInvited = (detail?.invites ?? []).some((invite) => invite.user.id === candidate.id);
                      return (
                        <div key={candidate.id} className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5">
                          <div className="w-6 h-6 rounded-full overflow-hidden bg-muted shrink-0">
                            <SmartImage src={candidate.avatarUrl ?? undefined} alt="" className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold truncate">
                              {candidate.displayName || candidate.username}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">@{candidate.username}</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant={alreadyMember || alreadyInvited ? "ghost" : "secondary"}
                            disabled={alreadyMember || alreadyInvited || invitingUserId === candidate.id}
                            onClick={() => inviteUser(candidate.id)}
                            className="h-7 rounded-full text-[11px] font-bold shrink-0"
                          >
                            {invitingUserId === candidate.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : alreadyMember ? (
                              t("dub.member")
                            ) : alreadyInvited ? (
                              t("dub.invited")
                            ) : (
                              <>
                                <UserPlus className="w-3 h-3" /> {t("dub.invite")}
                              </>
                            )}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={memberName}
                onChange={(event) => setMemberName(event.target.value)}
                maxLength={60}
                placeholder={t("dub.memberNamePlaceholder")}
                className="h-9 rounded-xl sm:max-w-[220px]"
              />
              <Select value={memberRole} onValueChange={(value) => setMemberRole(value as DubRole)}>
                <SelectTrigger className="h-9 rounded-xl sm:w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DUB_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {t(`dub.role.${role}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={addMember}
                disabled={addingMember}
                className="rounded-xl font-bold"
              >
                {addingMember ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {t("dub.addMember")}
              </Button>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Mic2 className="w-4 h-4 text-primary" />
              <p className="font-bold text-sm">{t("dub.creditsTitle")}</p>
            </div>
            {(detail?.credits ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("dub.noCredits")}</p>
            ) : (
              <div className="space-y-2">
                {detail?.credits.map((credit) => (
                  <div key={credit.id} className="flex items-start gap-3 rounded-xl border bg-card/40 p-3">
                    <div className="w-10 aspect-[2/3] rounded-md overflow-hidden shrink-0 bg-muted">
                      <SmartImage
                        src={credit.anime.coverImage ?? undefined}
                        alt={credit.anime.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{credit.anime.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t("dub.creditLine", {
                          language: t(`dub.lang.${credit.language}`),
                          speakers: credit.speakerCount,
                          members: linkedCount,
                          reputation: detail?.reputation ?? team.reputation,
                        })}
                        {credit.ratingCount > 0
                          ? t("dub.creditRating", { rating: credit.rating ?? "—", count: credit.ratingCount })
                          : ""}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                        {credit.cast.map((row) => `${row.speakerName} — ${row.character}`).join(", ")}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setConfirmCreditId(credit.id)}
                      disabled={removingCreditId === credit.id}
                      aria-label={t("dub.removeCredit", { title: credit.anime.title })}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      {removingCreditId === credit.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(removeCreditTarget)}
        onOpenChange={(open) => !removingCreditId && !open && setConfirmCreditId(null)}
      >
        <DialogContent className="sm:max-w-[420px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" /> {t("studio.deleteConfirmTitle")}
            </DialogTitle>
            <DialogDescription>{t("dub.removeCredit", { title: removeCreditTarget?.anime.title ?? "" })}</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 rounded-xl h-10" disabled={removingCreditId !== null} onClick={() => setConfirmCreditId(null)}>
              {t("studio.deleteConfirmCancel")}
            </Button>
            <Button
              className="flex-1 rounded-xl h-10 bg-destructive text-white font-bold hover:bg-destructive/90"
              disabled={removingCreditId !== null}
              onClick={() => confirmCreditId && removeCredit(confirmCreditId)}
            >
              {removingCreditId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {t("studio.deleteConfirmOk")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
