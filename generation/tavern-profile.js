const textOf = (value) => String(value ?? '').trim();

export function resolveTavernProfile(profiles = [], requestedProfile = '') {
  const requested = textOf(requestedProfile);
  if (!requested) return null;
  const profile = (Array.isArray(profiles) ? profiles : []).find((item) => (
    textOf(item?.id) === requested || textOf(item?.name) === requested
  ));
  if (!profile) return null;
  return {
    profile,
    profileId: textOf(profile.id),
    model: textOf(profile.model) || '酒馆预设（未指定模型）',
  };
}
