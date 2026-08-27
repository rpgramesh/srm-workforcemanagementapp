const fs = require('fs');
const file = 'features/roster/components/weekly-roster-grid.tsx';
let code = fs.readFileSync(file, 'utf8');

const headerCode = `
      <div className="flex items-center justify-between mb-4 px-1">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-900">Weekly Roster</h2>
          <p className="mt-1 text-sm text-slate-500">Upcoming shifts for this week</p>
        </div>
        <button
          type="button"
          onClick={() => (window.location.href = '/admin/schedule')}
          className="text-sm font-semibold text-slate-700 hover:text-slate-900"
        >
          View Full Month
        </button>
      </div>
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/[0.02]">
`;

code = code.replace(
  '<section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/[0.02]">',
  '<section>\n' + headerCode
);

code = code.replace(
  '      </div>\n    </section>',
  '      </div>\n      </div>\n    </section>'
);

fs.writeFileSync(file, code);
console.log("Patched!");
