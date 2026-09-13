import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Apple,
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  CirclePlus,
  History,
  Pencil,
  Settings2,
  Sparkles,
  Star,
  Target,
  Trash2,
  Utensils,
  X,
} from 'lucide-react';

type MacroValues = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type Food = MacroValues & {
  id: string;
  name: string;
};

type TrackerData = {
  goals: MacroValues;
  days: Record<string, { foods: Food[] }>;
  savedFoods: Food[];
};

type FoodForm = {
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
};

type GoalsForm = {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
};

type ModalName = 'food' | 'saved' | 'history' | 'goals' | null;

const STORAGE_KEY = 'macrotrack_data';
const EMPTY_FOODS: Food[] = [];
const DEFAULT_GOALS: MacroValues = { calories: 2500, protein: 150, carbs: 300, fat: 80 };

const emptyFoodForm: FoodForm = { name: '', calories: '', protein: '', carbs: '', fat: '' };

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(key: string, short = false) {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, short
    ? { weekday: 'short', month: 'short', day: 'numeric' }
    : { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

function numberOrZero(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function makeId(suffix = '') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${crypto.randomUUID()}${suffix}`;
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}${suffix}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeFood(value: unknown, fallbackId: string): Food | null {
  if (!isRecord(value) || typeof value.name !== 'string' || !value.name.trim()) return null;
  return {
    id: typeof value.id === 'string' && value.id ? value.id : fallbackId,
    name: value.name.trim().slice(0, 80),
    calories: numberOrZero(value.calories),
    protein: numberOrZero(value.protein),
    carbs: numberOrZero(value.carbs),
    fat: numberOrZero(value.fat),
  };
}

function loadData(): TrackerData {
  const fallback: TrackerData = { goals: { ...DEFAULT_GOALS }, days: {}, savedFoods: [] };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return fallback;
    const goalsSource = isRecord(parsed.goals) ? parsed.goals : {};
    const days: Record<string, { foods: Food[] }> = {};
    if (isRecord(parsed.days)) {
      Object.entries(parsed.days).forEach(([key, value]) => {
        const foodSource = isRecord(value) && Array.isArray(value.foods) ? value.foods : [];
        days[key] = {
          foods: foodSource
            .map((food, index) => normalizeFood(food, `${key}-${index}`))
            .filter((food): food is Food => Boolean(food)),
        };
      });
    }
    const savedFoods = Array.isArray(parsed.savedFoods)
      ? parsed.savedFoods
        .map((food, index) => normalizeFood(food, `saved-${index}`))
        .filter((food): food is Food => Boolean(food))
      : [];
    return {
      goals: {
        calories: numberOrZero(goalsSource.calories) || DEFAULT_GOALS.calories,
        protein: numberOrZero(goalsSource.protein) || DEFAULT_GOALS.protein,
        carbs: numberOrZero(goalsSource.carbs) || DEFAULT_GOALS.carbs,
        fat: numberOrZero(goalsSource.fat) || DEFAULT_GOALS.fat,
      },
      days,
      savedFoods,
    };
  } catch {
    return fallback;
  }
}

function persistData(data: TrackerData) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Private browsing and quota errors should never interrupt logging.
  }
}

function totalsFor(foods: Food[]): MacroValues {
  return foods.reduce((total, food) => ({
    calories: total.calories + food.calories,
    protein: total.protein + food.protein,
    carbs: total.carbs + food.carbs,
    fat: total.fat + food.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

function foodToForm(food?: Food): FoodForm {
  if (!food) return { ...emptyFoodForm };
  return {
    name: food.name,
    calories: String(food.calories),
    protein: String(food.protein),
    carbs: String(food.carbs),
    fat: String(food.fat),
  };
}

function goalToForm(goals: MacroValues): GoalsForm {
  return {
    calories: String(goals.calories),
    protein: String(goals.protein),
    carbs: String(goals.carbs),
    fat: String(goals.fat),
  };
}

function App() {
  const [data, setData] = useState<TrackerData>(() => loadData());
  const todayKey = getDateKey(new Date());
  const [currentDate, setCurrentDate] = useState(todayKey);
  const [modal, setModal] = useState<ModalName>(null);
  const [editingFoodId, setEditingFoodId] = useState<string | null>(null);
  const [foodForm, setFoodForm] = useState<FoodForm>({ ...emptyFoodForm });
  const [goalsForm, setGoalsForm] = useState<GoalsForm>(() => goalToForm(DEFAULT_GOALS));
  const [foodError, setFoodError] = useState('');
  const [goalsError, setGoalsError] = useState('');
  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);

  const currentFoods = data.days[currentDate]?.foods ?? EMPTY_FOODS;
  const totals = useMemo(() => totalsFor(currentFoods), [currentFoods]);
  const calorieGoal = data.goals.calories;
  const progress = calorieGoal > 0 ? Math.min((totals.calories / calorieGoal) * 100, 100) : 0;
  const isToday = currentDate === todayKey;

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2200);
  };

  const updateData = (updater: (previous: TrackerData) => TrackerData) => {
    setData((previous) => {
      const next = updater(previous);
      persistData(next);
      return next;
    });
  };

  useEffect(() => {
    if (!modal) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setModal(null);
    };
    window.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [modal]);

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  const openAddFood = () => {
    setEditingFoodId(null);
    setFoodForm({ ...emptyFoodForm });
    setFoodError('');
    setModal('food');
  };

  const openEditFood = (food: Food) => {
    setEditingFoodId(food.id);
    setFoodForm(foodToForm(food));
    setFoodError('');
    setModal('food');
  };

  const openGoals = () => {
    setGoalsForm(goalToForm(data.goals));
    setGoalsError('');
    setModal('goals');
  };

  const getFoodValues = () => ({
    calories: Number(foodForm.calories),
    protein: Number(foodForm.protein),
    carbs: Number(foodForm.carbs),
    fat: Number(foodForm.fat),
  });

  const saveFood = (saveFavorite: boolean) => {
    const name = foodForm.name.trim();
    const values = getFoodValues();
    if (!name) {
      setFoodError('Give this food a name first.');
      return;
    }
    if (Object.values(values).some((value) => !Number.isFinite(value) || value < 0)) {
      setFoodError('Use zero or a positive number for each nutrition value.');
      return;
    }
    const nextFood: Food = { id: editingFoodId ?? makeId(), name, ...values };
    updateData((previous) => {
      const previousDay = previous.days[currentDate] ?? { foods: [] };
      const foods = editingFoodId
        ? previousDay.foods.map((food) => food.id === editingFoodId ? nextFood : food)
        : [...previousDay.foods, nextFood];
      const savedFoods = saveFavorite && !editingFoodId
        ? [...previous.savedFoods, { ...nextFood, id: makeId('-saved') }]
        : previous.savedFoods;
      return {
        ...previous,
        days: { ...previous.days, [currentDate]: { foods } },
        savedFoods,
      };
    });
    setModal(null);
    showToast(editingFoodId ? 'Food changes saved' : saveFavorite ? 'Added and saved to favorites' : 'Food added to today');
  };

  const deleteFood = (food: Food) => {
    if (!window.confirm(`Remove ${food.name} from ${isToday ? 'today' : formatDate(currentDate, true)}?`)) return;
    updateData((previous) => ({
      ...previous,
      days: {
        ...previous.days,
        [currentDate]: { foods: (previous.days[currentDate]?.foods ?? []).filter((item) => item.id !== food.id) },
      },
    }));
    showToast('Food removed');
  };

  const addSavedFood = (food: Food) => {
    updateData((previous) => ({
      ...previous,
      days: {
        ...previous.days,
        [currentDate]: {
          foods: [...(previous.days[currentDate]?.foods ?? []), { ...food, id: makeId() }],
        },
      },
    }));
    setModal(null);
    showToast(`${food.name} added`);
  };

  const deleteSavedFood = (food: Food) => {
    if (!window.confirm(`Delete ${food.name} from favorites?`)) return;
    updateData((previous) => ({ ...previous, savedFoods: previous.savedFoods.filter((item) => item.id !== food.id) }));
    showToast('Favorite deleted');
  };

  const saveGoals = () => {
    const values = {
      calories: Number(goalsForm.calories),
      protein: Number(goalsForm.protein),
      carbs: Number(goalsForm.carbs),
      fat: Number(goalsForm.fat),
    };
    if (Object.values(values).some((value) => !Number.isFinite(value) || value <= 0)) {
      setGoalsError('Set each target above zero so your progress has something to aim for.');
      return;
    }
    updateData((previous) => ({ ...previous, goals: values }));
    setModal(null);
    showToast('Daily targets updated');
  };

  const historyDates = Object.keys(data.days)
    .filter((key) => data.days[key]?.foods?.length)
    .sort((a, b) => b.localeCompare(a));

  const updateFoodField = (field: keyof FoodForm, value: string) => {
    setFoodForm((previous) => ({ ...previous, [field]: value }));
    if (foodError) setFoodError('');
  };

  const updateGoalField = (field: keyof GoalsForm, value: string) => {
    setGoalsForm((previous) => ({ ...previous, [field]: value }));
    if (goalsError) setGoalsError('');
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <div className="brand" aria-label="MacroTrack home">
            <div className="brand-mark"><Apple size={18} strokeWidth={2.4} /></div>
            <div className="brand-name">Macro<span>Track</span></div>
          </div>
          <div className="header-actions">
            {!isToday && (
              <button className="quiet-button" type="button" onClick={() => setCurrentDate(todayKey)} data-testid="button-back-to-today">
                <ArrowLeft size={15} /> Today
              </button>
            )}
            <button className="icon-button" type="button" onClick={openGoals} aria-label="Edit daily targets" data-testid="button-open-settings">
              <Settings2 size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <section className="hero-row">
          <div>
            <p className="eyebrow">{isToday ? 'Your daily rhythm' : 'Looking back'}</p>
            <h1 className="hero-title">{isToday ? 'Eat well. Keep moving.' : formatDate(currentDate)}</h1>
            <p className="hero-subtitle">
              {isToday ? 'A little awareness goes a long way. Keep this space simple, honest, and yours.' : 'A quiet snapshot of what you logged on this day.'}
            </p>
          </div>
          <div className="date-switcher" data-testid="text-current-date">
            <CalendarDays size={15} />
            <strong>{isToday ? 'Today' : formatDate(currentDate, true)}</strong>
          </div>
        </section>

        <div className="dashboard-grid">
          <section className="card summary-card" aria-labelledby="summary-heading">
            <div className="summary-heading">
              <div>
                <p className="summary-kicker" id="summary-heading">Calories logged</p>
                <p className="summary-total" data-testid="text-total-calories">
                  {Math.round(totals.calories)}<span>/ {Math.round(calorieGoal)} kcal</span>
                </p>
                <p className="remaining-pill" data-testid="text-calories-remaining">
                  {totals.calories >= calorieGoal ? `${Math.round(totals.calories - calorieGoal)} over target` : `${Math.round(calorieGoal - totals.calories)} left for today`}
                </p>
              </div>
              <Sparkles size={22} color="hsl(44 73% 51%)" aria-hidden="true" />
            </div>
            <div className="progress-track" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Calories progress">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="macro-grid">
              <MacroStat label="Protein" value={totals.protein} target={data.goals.protein} testId="protein" />
              <MacroStat label="Carbs" value={totals.carbs} target={data.goals.carbs} testId="carbs" />
              <MacroStat label="Fat" value={totals.fat} target={data.goals.fat} testId="fat" />
            </div>
          </section>

          <aside className="card side-card">
            <h2>Make it easy</h2>
            <p>Keep your go-to meals close, then get back to your day.</p>
            <div className="quick-links">
              <button className="quick-link" type="button" onClick={() => setModal('saved')} data-testid="button-open-favorites">
                <span className="quick-link-copy">
                  <span className="quick-link-icon"><Star size={16} /></span>
                  <span><span className="quick-link-label">Favorite foods</span><span className="quick-link-caption">{data.savedFoods.length ? `${data.savedFoods.length} ready to add` : 'Save a meal you love'}</span></span>
                </span>
                <ChevronRight size={16} />
              </button>
              <button className="quick-link" type="button" onClick={() => setModal('history')} data-testid="button-open-history">
                <span className="quick-link-copy">
                  <span className="quick-link-icon"><History size={16} /></span>
                  <span><span className="quick-link-label">Your history</span><span className="quick-link-caption">{historyDates.length ? `${historyDates.length} logged days` : 'Your first entry is ahead'}</span></span>
                </span>
                <ChevronRight size={16} />
              </button>
              <button className="quick-link" type="button" onClick={openGoals} data-testid="button-open-goals">
                <span className="quick-link-copy">
                  <span className="quick-link-icon"><Target size={16} /></span>
                  <span><span className="quick-link-label">Daily targets</span><span className="quick-link-caption">{Math.round(data.goals.calories)} kcal · {formatNumber(data.goals.protein)}g protein</span></span>
                </span>
                <ChevronRight size={16} />
              </button>
            </div>
          </aside>
        </div>

        <section className="food-section" aria-labelledby="food-heading">
          <div className="section-heading">
            <h2 id="food-heading">{isToday ? "Today's food" : 'Food logged'}</h2>
            <p>{currentFoods.length ? `${currentFoods.length} ${currentFoods.length === 1 ? 'entry' : 'entries'}` : 'Nothing logged yet'}</p>
          </div>
          <div className="card food-card">
            {currentFoods.length === 0 ? (
              <div className="empty-state" data-testid="empty-food-state">
                <div className="empty-orbit"><Utensils size={24} /></div>
                <h3>A blank page, for now.</h3>
                <p>Start with anything: breakfast, a snack, or the meal you already know by heart.</p>
                <button className="outline-button" type="button" onClick={openAddFood} data-testid="button-empty-add-food"><CirclePlus size={16} /> Add your first food</button>
              </div>
            ) : (
              currentFoods.map((food) => (
                <div className="food-row" key={food.id} data-testid={`row-food-${food.id}`}>
                  <div className="food-main">
                    <p className="food-name" data-testid={`text-food-name-${food.id}`}>{food.name}</p>
                    <p className="food-meta">{formatNumber(food.protein)}g P <span aria-hidden="true">·</span> {formatNumber(food.carbs)}g C <span aria-hidden="true">·</span> {formatNumber(food.fat)}g F</p>
                  </div>
                  <div className="food-calories" data-testid={`text-food-calories-${food.id}`}>{Math.round(food.calories)} kcal</div>
                  <div className="row-actions">
                    <button className="row-action" type="button" onClick={() => openEditFood(food)} aria-label={`Edit ${food.name}`} data-testid={`button-edit-food-${food.id}`}><Pencil size={15} /></button>
                    <button className="row-action delete" type="button" onClick={() => deleteFood(food)} aria-label={`Delete ${food.name}`} data-testid={`button-delete-food-${food.id}`}><Trash2 size={15} /></button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      <button className="floating-add" type="button" onClick={openAddFood} data-testid="button-add-food"><CirclePlus size={18} /> Add food</button>

      {modal === 'food' && (
        <Modal title={editingFoodId ? 'Edit food' : 'Add food'} description={editingFoodId ? 'Make a small correction or refresh the numbers.' : 'Log the meal while it is still fresh.'} onClose={() => setModal(null)} testId="modal-food">
          <div className="form-field">
            <label className="form-label" htmlFor="food-name">Food name</label>
            <input className="form-input" id="food-name" value={foodForm.name} onChange={(event) => updateFoodField('name', event.target.value)} placeholder="Chicken and rice" autoFocus data-testid="input-food-name" />
          </div>
          <div className="form-grid">
            <NumberField id="food-calories" label="Calories" value={foodForm.calories} onChange={(value) => updateFoodField('calories', value)} placeholder="500" />
            <NumberField id="food-protein" label="Protein (g)" value={foodForm.protein} onChange={(value) => updateFoodField('protein', value)} placeholder="40" step="0.1" />
            <NumberField id="food-carbs" label="Carbs (g)" value={foodForm.carbs} onChange={(value) => updateFoodField('carbs', value)} placeholder="50" step="0.1" />
            <NumberField id="food-fat" label="Fat (g)" value={foodForm.fat} onChange={(value) => updateFoodField('fat', value)} placeholder="15" step="0.1" />
          </div>
          {foodError && <p className="form-error" role="alert" data-testid="error-food-form">{foodError}</p>}
          <div className="modal-actions">
            <button className="outline-button" type="button" onClick={() => setModal(null)} data-testid="button-cancel-food">Cancel</button>
            <button className="primary-button" type="button" onClick={() => saveFood(false)} data-testid="button-save-food"><Check size={16} /> {editingFoodId ? 'Save changes' : 'Add food'}</button>
          </div>
          {!editingFoodId && <button className="favorite-button" type="button" onClick={() => saveFood(true)} data-testid="button-add-save-favorite"><Star size={16} /> Add & save as favorite</button>}
        </Modal>
      )}

      {modal === 'saved' && (
        <Modal title="Favorite foods" description="Your reliable choices, ready in one tap." onClose={() => setModal(null)} testId="modal-favorites">
          {data.savedFoods.length === 0 ? (
            <div className="modal-empty" data-testid="empty-favorites-state">No favorites yet. Add a food and save it here for next time.</div>
          ) : (
            <div className="list-stack">
              {data.savedFoods.map((food) => (
                <div className="saved-row" key={food.id} data-testid={`row-favorite-${food.id}`}>
                  <div className="saved-copy">
                    <strong>{food.name}</strong>
                    <span>{Math.round(food.calories)} kcal · {formatNumber(food.protein)}g P · {formatNumber(food.carbs)}g C · {formatNumber(food.fat)}g F</span>
                  </div>
                  <button className="small-button" type="button" onClick={() => addSavedFood(food)} data-testid={`button-add-favorite-${food.id}`}>Add</button>
                  <button className="small-icon" type="button" onClick={() => deleteSavedFood(food)} aria-label={`Delete ${food.name} favorite`} data-testid={`button-delete-favorite-${food.id}`}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}
          <button className="primary-button full-button" type="button" onClick={() => { setModal('food'); setEditingFoodId(null); setFoodForm({ ...emptyFoodForm }); setFoodError(''); }} style={{ marginTop: '1rem' }} data-testid="button-create-favorite"><CirclePlus size={16} /> Create a favorite food</button>
        </Modal>
      )}

      {modal === 'history' && (
        <Modal title="History" description="Notice the pattern, not the perfection." onClose={() => setModal(null)} testId="modal-history">
          {historyDates.length === 0 ? (
            <div className="modal-empty" data-testid="empty-history-state">Logged days will appear here as you go.</div>
          ) : (
            <div className="list-stack">
              {historyDates.map((date) => {
                const dayTotals = totalsFor(data.days[date].foods);
                return (
                  <button className="history-row" type="button" key={date} onClick={() => { setCurrentDate(date); setModal(null); }} data-testid={`button-history-${date}`}>
                    <span className="quick-link-icon"><CalendarDays size={15} /></span>
                    <span className="history-copy"><strong>{date === todayKey ? 'Today' : formatDate(date, true)}</strong><span>{Math.round(dayTotals.calories)} kcal · {data.days[date].foods.length} {data.days[date].foods.length === 1 ? 'entry' : 'entries'}</span></span>
                    <ChevronRight size={16} />
                  </button>
                );
              })}
            </div>
          )}
          {!isToday && <button className="outline-button full-button" type="button" onClick={() => { setCurrentDate(todayKey); setModal(null); }} style={{ marginTop: '1rem' }} data-testid="button-history-back-today"><ArrowLeft size={15} /> Back to today</button>}
        </Modal>
      )}

      {modal === 'goals' && (
        <Modal title="Daily targets" description="Choose targets that support the way you want to feel." onClose={() => setModal(null)} testId="modal-goals">
          <div className="form-grid">
            <NumberField id="goal-calories" label="Calories" value={goalsForm.calories} onChange={(value) => updateGoalField('calories', value)} />
            <NumberField id="goal-protein" label="Protein (g)" value={goalsForm.protein} onChange={(value) => updateGoalField('protein', value)} step="0.1" />
            <NumberField id="goal-carbs" label="Carbs (g)" value={goalsForm.carbs} onChange={(value) => updateGoalField('carbs', value)} step="0.1" />
            <NumberField id="goal-fat" label="Fat (g)" value={goalsForm.fat} onChange={(value) => updateGoalField('fat', value)} step="0.1" />
          </div>
          {goalsError && <p className="form-error" role="alert" data-testid="error-goals-form">{goalsError}</p>}
          <div className="modal-actions">
            <button className="outline-button" type="button" onClick={() => setModal(null)} data-testid="button-cancel-goals">Cancel</button>
            <button className="primary-button" type="button" onClick={saveGoals} data-testid="button-save-goals"><Check size={16} /> Save targets</button>
          </div>
          <p className="modal-note">Targets are saved only on this device. You can adjust them whenever your training, appetite, or routine changes.</p>
        </Modal>
      )}

      <div className={`toast ${toast ? 'visible' : ''}`} role="status" aria-live="polite" data-testid="status-toast">
        <Check size={15} /> {toast}
      </div>
    </div>
  );
}

function MacroStat({ label, value, target, testId }: { label: string; value: number; target: number; testId: string }) {
  return (
    <div className="macro-stat" data-testid={`stat-${testId}`}>
      <div className="macro-label"><span className="macro-dot" />{label}</div>
      <div className="macro-value">{formatNumber(value)}g</div>
      <div className="macro-target">of {formatNumber(target)}g</div>
    </div>
  );
}

function NumberField({ id, label, value, onChange, placeholder, step = '1' }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string; step?: string }) {
  return (
    <div className="form-field">
      <label className="form-label" htmlFor={id}>{label}</label>
      <input className="form-input" id={id} type="number" min="0" step={step} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} data-testid={`input-${id}`} />
    </div>
  );
}

function Modal({ title, description, onClose, children, testId }: { title: string; description: string; onClose: () => void; children: ReactNode; testId: string }) {
  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby={`${testId}-title`} data-testid={testId}>
        <div className="modal-header">
          <div>
            <h2 id={`${testId}-title`}>{title}</h2>
            <p>{description}</p>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label={`Close ${title}`} data-testid={`button-close-${testId}`}><X size={17} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default App;