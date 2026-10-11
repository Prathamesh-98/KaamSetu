const fs = require('fs');
const path = 'src/pages/employer/PostJobPage.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /<h1 className="text-2xl font-bold text-dark">/g,
  '<h1 className="text-2xl font-bold" style={{ color: \'#182849\' }}>'
);
content = content.replace(
  /className="card p-6 space-y-5"/g,
  'className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 space-y-6"'
);
content = content.replace(
  /className="card p-6 space-y-6"/g,
  'className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 space-y-6"'
);
content = content.replace(
  /className="grid grid-cols-2 gap-4"/g,
  'className="grid grid-cols-2 gap-6"'
);

const targetFormStep0 = `          <div>
            <label className="label">Job Title *</label>
            <input
              type="text"
              className="input w-full"
              placeholder="e.g. Experienced Electrician Needed"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              maxLength={100}
            />
          </div>

          <div>
            <label className="label mb-2 block">Job Image</label>
            <ImageUploader
              currentImageUrl={form.image_url}
              onUploadSuccess={(url) => set('image_url', url)}
              folder="kaamsetu/jobs"
              shape="rectangle"
            />
            <p className="text-xs text-gray-500 mt-2">Add an image to make your job posting stand out (optional).</p>
          </div>

          <div>
            <label className="label">Category *</label>
            <select
              className="input w-full"
              value={form.category_id}
              onChange={(e) => set('category_id', e.target.value)}
            >
              <option value="">Select a category...</option>
              {categories?.map((cat) => (
                <option key={cat.id} value={cat.id}>{t(\`categories.\${cat.name}\`, { defaultValue: cat.name })}</option>
              ))}
            </select>
          </div>`;

const replFormStep0 = `          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label className="label">Job Title *</label>
              <input
                type="text"
                className="input w-full"
                placeholder="e.g. Experienced Electrician Needed"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                maxLength={100}
              />
            </div>
            <div>
              <label className="label">Category *</label>
              <select
                className="input w-full"
                value={form.category_id}
                onChange={(e) => set('category_id', e.target.value)}
              >
                <option value="">Select a category...</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>{t(\`categories.\${cat.name}\`, { defaultValue: cat.name })}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label mb-2 block">Job Image</label>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <ImageUploader
                currentImageUrl={form.image_url}
                onUploadSuccess={(url) => set('image_url', url)}
                folder="kaamsetu/jobs"
                shape="rectangle"
              />
              <p className="text-xs text-gray-500 mt-2">Add an image to make your job posting stand out (optional).</p>
            </div>
          </div>`;

content = content.replace(targetFormStep0, replFormStep0);

fs.writeFileSync(path, content);
