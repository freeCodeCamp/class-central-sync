import { pickCourseFields, pickSubjectFields } from './course-fields.js';

const rawCourse = () => ({
  id: 83023,
  name: 'How to Draw the Head from Every Angle: Part Three',
  slug: 'skillshare-how-to-draw-the-head-from-every-angle-part-three',
  format: 'course',
  credential: null,
  description: '<p>Long HTML nobody reads back...</p>',
  summary: 'A short summary.',
  url: {
    course: 'https://www.classcentral.com/course/example-83023?ref=fcc',
    go: 'https://www.classcentral.com/course/example-83023?go=1&ref=fcc',
  },
  imageUrl: 'https://example.com/img/course.jpeg',
  instructors: 'Nina Rycroft',
  level: 'intermediate',
  available: true,
  availability: 'Self-Paced',
  free: false,
  price: 'Free Trial Available',
  certificate: false,
  effort: '20 minutes',
  rating: {
    classCentral: null,
    provider: { average: 4.79167, count: 89 },
  },
  language: { name: 'English', slug: 'english' },
  provider: {
    name: 'Skillshare',
    code: 'skillshare',
    logo: { horizontal: 'https://example.com/logo-hz.png' },
  },
  institutions: [],
  subjects: [{ name: 'Drawing', slug: 'drawing' }],
});

const rawSubject = () => ({
  name: 'Drawing',
  slug: 'drawing',
  courseCount: 1182,
  url: 'https://www.classcentral.com/subject/drawing?ref=fcc',
});

describe('pickCourseFields:', () => {
  test('keeps only the fields News renders', () => {
    expect(pickCourseFields(rawCourse())).toEqual({
      id: 83023,
      name: 'How to Draw the Head from Every Angle: Part Three',
      url: {
        go: 'https://www.classcentral.com/course/example-83023?go=1&ref=fcc',
      },
      imageUrl: 'https://example.com/img/course.jpeg',
      instructors: 'Nina Rycroft',
      level: 'intermediate',
      certificate: false,
      effort: '20 minutes',
      rating: { provider: { average: 4.79167, count: 89 } },
      provider: { name: 'Skillshare' },
    });
  });

  test('defaults rating.provider to null when the provider has no rating', () => {
    const course = rawCourse();
    course.rating.provider = null;

    expect(pickCourseFields(course).rating).toEqual({ provider: null });
  });
});

describe('pickSubjectFields:', () => {
  test('keeps only name and url', () => {
    expect(pickSubjectFields(rawSubject())).toEqual({
      name: 'Drawing',
      url: 'https://www.classcentral.com/subject/drawing?ref=fcc',
    });
  });
});
