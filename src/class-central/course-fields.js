// Keep only what News actually uses to shrink the cache, plus `id`,
// to dedupe repeated courses across posts
export const pickCourseFields = (course) => ({
  id: course.id,
  name: course.name,
  url: { go: course.url?.go },
  imageUrl: course.imageUrl,
  instructors: course.instructors,
  level: course.level,
  certificate: course.certificate,
  effort: course.effort,
  rating: { provider: course.rating?.provider ?? null },
  provider: { name: course.provider?.name },
});

export const pickSubjectFields = (subject) => ({
  name: subject.name,
  url: subject.url,
});
