/**
 * Generates the CV fixtures the upload specs need, into `e2e/test-cvs/`.
 *
 * That directory is gitignored, and has been since it was added: the comment
 * beside it in `.gitignore` reads "generated test CVs". The generator itself
 * was simply never written, so the specs that depend on it could not run on any
 * clone (#83).
 *
 * The PDFs are written by hand rather than with a library. A text-bearing PDF
 * is a short, well-specified format, and the alternatives were worse: adding a
 * PDF dependency to the client for test fixtures, or committing binaries. Each
 * file carries one page of plain text drawn with Tj operators, which is what
 * the server's extractor reads.
 *
 * The people in these CVs are invented. Emails use `.invalid`, which is
 * reserved by RFC 2606 and can never route anywhere.
 *
 * Since #93 the API rejects a CV whose bytes match one it already holds, by
 * content hash, against both pending drafts and every approved candidate's CV.
 * Identical fixtures would therefore be refused on every run after the first,
 * and permanently once a spec approves one. So the specs never reuse a file:
 * each asks for a fresh set with its own salt, written as a PDF comment. A
 * comment changes the bytes, and so the hash, without changing a single
 * character of the text the parser extracts.
 *
 *   node e2e/make-test-cvs.mjs                    # unsalted set in e2e/test-cvs
 *   node e2e/make-test-cvs.mjs --force            # overwrite that set
 *   node e2e/make-test-cvs.mjs --salt X --out D   # salted set in D (what the specs use)
 */
import fs from 'node:fs';
import path from 'node:path';

/** The value following a flag, e.g. `--out dir`, or undefined when absent. */
const arg = (flag) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? undefined : process.argv[i + 1];
};

const OUT = path.resolve(arg('--out') ?? 'e2e/test-cvs');
const SALT = arg('--salt');
// A salted set exists to be unique, so there is nothing worth keeping from before.
const FORCE = process.argv.includes('--force') || SALT !== undefined;

if (SALT !== undefined && !/^[\w-]{1,64}$/.test(SALT)) {
  // Written into the PDF verbatim, so keep it to characters a comment line can
  // hold without escaping.
  console.error(`--salt must be 1-64 letters, digits, '_' or '-'; got ${JSON.stringify(SALT)}`);
  process.exit(2);
}

/** Invented candidates. Varied enough that parsing has something to chew on. */
const PEOPLE = [
  { name: 'Arif Hossain', role: 'Senior Backend Engineer', years: 8, skills: 'C#, .NET, SQL Server, Azure', degree: 'BSc in Computer Science', uni: 'Bangladesh University of Engineering and Technology', year: '2016', cgpa: '3.78', company: 'Finstack Limited', title: 'Lead Backend Engineer', period: '2020 - Present' },
  { name: 'Nusrat Jahan', role: 'Frontend Engineer', years: 5, skills: 'React, TypeScript, Vite, CSS', degree: 'BSc in Software Engineering', uni: 'North South University', year: '2019', cgpa: '3.62', company: 'Pixelforge', title: 'Frontend Engineer', period: '2021 - Present' },
  { name: 'Tanvir Rahman', role: 'Full Stack Engineer', years: 6, skills: 'Node.js, React, PostgreSQL, Docker', degree: 'BSc in Computer Science', uni: 'University of Dhaka', year: '2018', cgpa: '3.55', company: 'Orbital Systems', title: 'Full Stack Developer', period: '2019 - Present' },
  { name: 'Farzana Akter', role: 'Machine Learning Engineer', years: 4, skills: 'Python, PyTorch, Pandas, MLflow', degree: 'MSc in Data Science', uni: 'Jahangirnagar University', year: '2021', cgpa: '3.85', company: 'Deepfield Analytics', title: 'ML Engineer', period: '2021 - Present' },
  { name: 'Imran Chowdhury', role: 'DevOps Engineer', years: 7, skills: 'Kubernetes, Terraform, AWS, Go', degree: 'BSc in Electrical Engineering', uni: 'Khulna University of Engineering and Technology', year: '2017', cgpa: '3.41', company: 'Cloudbridge', title: 'Senior DevOps Engineer', period: '2020 - Present' },
  { name: 'Sadia Islam', role: 'QA Automation Engineer', years: 5, skills: 'Playwright, TypeScript, Cypress, CI', degree: 'BSc in Computer Science', uni: 'Chittagong University', year: '2019', cgpa: '3.50', company: 'Testlane', title: 'QA Automation Lead', period: '2022 - Present' },
  { name: 'Rakib Hasan', role: 'Mobile Engineer', years: 6, skills: 'Kotlin, Swift, Flutter, Firebase', degree: 'BSc in Computer Science', uni: 'Rajshahi University', year: '2018', cgpa: '3.33', company: 'Appcrate', title: 'Android Lead', period: '2021 - Present' },
  { name: 'Mehjabin Ara', role: 'Data Engineer', years: 5, skills: 'Spark, Airflow, SQL, Snowflake', degree: 'BSc in Statistics', uni: 'University of Dhaka', year: '2019', cgpa: '3.70', company: 'Gridpoint Data', title: 'Data Engineer', period: '2020 - Present' },
  { name: 'Shahriar Kabir', role: 'Security Engineer', years: 9, skills: 'AppSec, Burp Suite, Python, Threat Modelling', degree: 'MSc in Information Security', uni: 'Military Institute of Science and Technology', year: '2015', cgpa: '3.90', company: 'Sentinel Labs BD', title: 'Security Engineer II', period: '2018 - Present' },
  {
    name: 'Alex Rivera', role: 'Senior Backend Engineer', years: 9,
    skills: 'C#, .NET, Kafka, Redis, Kubernetes',
    degree: 'BSc in Computer Science & Engineering',
    uni: 'Bangladesh University of Engineering and Technology', year: '2015', cgpa: '3.81',
    company: 'Brain Station 23', title: 'Senior Backend Engineer', period: '2019 - Present',
    leetcode: 'alexrivera', codeforces: 'alexrivera',
    file: 'Alex_Rivera_Senior_Backend_Engineer.pdf',
  },
  { name: 'Lamia Siddique', role: 'Platform Engineer', years: 4, skills: 'Go, gRPC, Postgres, Observability', degree: 'BSc in Computer Science', uni: 'Islamic University of Technology', year: '2020', cgpa: '3.66', company: 'Northwind Cloud', title: 'Platform Engineer', period: '2021 - Present' },
];

/** PDF strings escape backslash and both parens. */
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

function cvLines(p) {
  const handle = p.name.toLowerCase().replace(/\s+/g, '.');
  return [
    p.name,
    p.role,
    `Email: ${handle}@example.invalid`,
    'Phone: +8801700000000',
    'Dhaka, Bangladesh',
    `LinkedIn: https://www.linkedin.com/in/${handle.replace(/\./g, '-')}`,
    `GitHub: https://github.com/${handle.split('.')[0]}`,
    ...(p.leetcode ? [`LeetCode: https://leetcode.com/u/${p.leetcode}`] : []),
    ...(p.codeforces ? [`Codeforces: https://codeforces.com/profile/${p.codeforces}`] : []),
    '',
    'PROFESSIONAL SUMMARY',
    `${p.role} with ${p.years} years of experience building production systems.`,
    '',
    'TECHNICAL SKILLS',
    p.skills,
    '',
    'WORK EXPERIENCE',
    `${p.title} | ${p.company} | ${p.period}`,
    'Designed, shipped and operated services used across the business.',
    `Relevant Experience: ${p.years} years`,
    '',
    'EDUCATION',
    `${p.degree}`,
    `${p.uni}, ${p.year}`,
    `CGPA: ${p.cgpa}`,
  ];
}

/** A one-page PDF carrying the given lines as selectable text. */
function buildPdf(lines) {
  const leading = 16;
  const body = lines
    .map((line, i) => (i === 0 ? `(${esc(line)}) Tj` : `T* (${esc(line)}) Tj`))
    .join('\n');
  const content = `BT\n/F1 11 Tf\n${leading} TL\n56 760 Td\n${body}\nET\n`;

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];

  // Line two of a PDF is conventionally a comment, and comments are ignored by
  // every reader and by text extraction alike. It goes in before any object, so
  // the xref offsets below are measured with it already in place.
  let pdf = `%PDF-1.4\n${SALT ? `%rg-fixture ${SALT}\n` : ''}`;
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const startxref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

fs.mkdirSync(OUT, { recursive: true });

let written = 0;
let kept = 0;
for (const person of PEOPLE) {
  // CVParserService.ParseNameAndTitleFromFileName splits on - and _ and reads
  // First-Last then the rest as the job title, so the filename carries both. A
  // numeric prefix would be taken as the first name.
  const file = path.join(
    OUT,
    person.file ?? `${[person.name, person.role].join(' ').replace(/\s+/g, '-')}.pdf`,
  );
  if (fs.existsSync(file) && !FORCE) {
    kept += 1;
    continue;
  }
  fs.writeFileSync(file, buildPdf(cvLines(person)));
  written += 1;
}

console.log(
  `test CVs in ${OUT}: ${written} written, ${kept} already present (${PEOPLE.length} total).`,
);
