import React, { useState, useMemo } from 'react';
import { EXERCISES } from '../data/exercises';
import ExerciseCard from '../components/ExerciseCard';
import { ArrowLeft, Search, Filter, Heart, History, Sparkles } from 'lucide-react';
import { getFavorites, toggleFavorite, getWorkoutHistory } from '../utils/storage';

export default function ExerciseSelection({ onSelectExercise, selectedExercise, onBack }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('All');
  const [muscleFilter, setMuscleFilter] = useState('All');
  const [viewFilter, setViewFilter] = useState('all'); // 'all' | 'favorites' | 'recent'
  const [favorites, setFavorites] = useState(getFavorites());

  const workoutHistory = useMemo(() => getWorkoutHistory(), []);
  const recentExerciseIds = useMemo(() => {
    return Array.from(new Set(workoutHistory.map(s => s.exerciseId)));
  }, [workoutHistory]);

  const handleToggleFav = (exerciseId) => {
    const updated = toggleFavorite(exerciseId);
    setFavorites(updated);
  };

  const filteredExercises = useMemo(() => {
    return EXERCISES.filter((ex) => {
      // Search
      const matchesSearch = 
        ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.shortDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ex.targetMuscles.some(m => m.toLowerCase().includes(searchQuery.toLowerCase()));

      // Difficulty
      const matchesDiff = difficultyFilter === 'All' || ex.difficulty === difficultyFilter;

      // Muscle
      const matchesMuscle = muscleFilter === 'All' || 
        (muscleFilter === 'Legs' && ex.category.includes('Legs')) ||
        (muscleFilter === 'Back' && ex.category.includes('Back')) ||
        (muscleFilter === 'Shoulders' && ex.category.includes('Shoulders')) ||
        (muscleFilter === 'Chest' && (ex.category.includes('Chest') || ex.category.includes('Core')));

      // View Tab
      let matchesView = true;
      if (viewFilter === 'favorites') {
        matchesView = favorites.includes(ex.id);
      } else if (viewFilter === 'recent') {
        matchesView = recentExerciseIds.includes(ex.id);
      }

      return matchesSearch && matchesDiff && matchesMuscle && matchesView;
    });
  }, [searchQuery, difficultyFilter, muscleFilter, viewFilter, favorites, recentExerciseIds]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 animate-fade-in">
      
      {/* Top Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2.5 rounded-full bg-[#FFFFFF] hover:bg-[#F3F0FF] border border-[#E2D9F3] text-[#2F3159] transition-colors shadow-sm"
          title="Back to Welcome Page"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#7F00FF]">
            Exercise Exploration
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#2F3159] tracking-tight">
            Find Your Movement
          </h1>
        </div>
      </div>

      <p className="text-base text-[#696C92] max-w-2xl -mt-2 mb-8 leading-relaxed">
        Choose an exercise and let's work on your form. Our peaceful vision model tracks your natural body angles and guides you toward balanced alignment.
      </p>

      {/* Search & Filter Toolbar */}
      <div className="calm-card p-5 mb-8 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#696C92] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search exercises, muscles, or movement..."
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-full bg-[#FFFFFF] border border-[#E2D9F3] focus:border-[#7F00FF] text-[#2F3159] placeholder-[#696C92] focus:outline-none transition-colors"
          />
        </div>

        {/* View Tabs: All / Favorites / Recent */}
        <div className="flex items-center gap-1 bg-[#F3F0FF] p-1 rounded-full border border-[#E2D9F3] self-start md:self-auto">
          <button
            onClick={() => setViewFilter('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              viewFilter === 'all'
                ? 'bg-[#FFFFFF] text-[#2F3159] shadow-sm'
                : 'text-[#696C92] hover:text-[#2F3159]'
            }`}
          >
            All ({EXERCISES.length})
          </button>

          <button
            onClick={() => setViewFilter('favorites')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewFilter === 'favorites'
                ? 'bg-[#FFFFFF] text-[#2F3159] shadow-sm'
                : 'text-[#696C92] hover:text-[#2F3159]'
            }`}
          >
            <Heart className="w-3.5 h-3.5 text-[#D32F2F]" />
            <span>Favorites</span>
          </button>

          <button
            onClick={() => setViewFilter('recent')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewFilter === 'recent'
                ? 'bg-[#FFFFFF] text-[#2F3159] shadow-sm'
                : 'text-[#696C92] hover:text-[#2F3159]'
            }`}
          >
            <History className="w-3.5 h-3.5 text-[#7F00FF]" />
            <span>Recent</span>
          </button>
        </div>

      </div>

      {/* Filter Category Chips: Difficulty & Muscle */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <span className="text-xs font-medium text-[#696C92] mr-1">Filter by:</span>

        {/* Difficulty */}
        {['All', 'Beginner'].map((diff) => (
          <button
            key={diff}
            onClick={() => setDifficultyFilter(diff)}
            className={`px-3.5 py-1 rounded-full text-xs font-medium transition-all ${
              difficultyFilter === diff
                ? 'bg-[#2F3159] text-white'
                : 'bg-[#FFFFFF] text-[#696C92] border border-[#E2D9F3] hover:border-[#7F00FF]'
            }`}
          >
            {diff === 'All' ? 'All Difficulties' : diff}
          </button>
        ))}

        <span className="text-[#E2D9F3] mx-1">|</span>

        {/* Muscle */}
        {['All', 'Legs & Lower Body', 'Chest & Core'].map((muscle) => (
          <button
            key={muscle}
            onClick={() => setMuscleFilter(muscle)}
            className={`px-3.5 py-1 rounded-full text-xs font-medium transition-all ${
              muscleFilter === muscle
                ? 'bg-[#7F00FF] text-white'
                : 'bg-[#FFFFFF] text-[#696C92] border border-[#E2D9F3] hover:border-[#7F00FF]'
            }`}
          >
            {muscle === 'All' ? 'All Movement Categories' : muscle}
          </button>
        ))}
      </div>

      {/* Grid of Exercises */}
      {filteredExercises.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {filteredExercises.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              isSelected={selectedExercise?.id === exercise.id}
              isFavorite={favorites.includes(exercise.id)}
              onToggleFavorite={handleToggleFav}
              onSelect={onSelectExercise}
            />
          ))}
        </div>
      ) : (
        <div className="calm-card p-12 text-center text-[#696C92]">
          <p className="text-sm font-semibold text-[#2F3159]">No exercises match your filter.</p>
          <p className="text-xs mt-1">Try resetting your search query or selecting "All".</p>
          <button
            onClick={() => { setSearchQuery(''); setDifficultyFilter('All'); setMuscleFilter('All'); setViewFilter('all'); }}
            className="mt-4 px-5 py-2 rounded-full text-xs font-semibold bg-[#EDE9FE] text-[#2F3159] hover:bg-[#7F00FF] hover:text-white transition-colors"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Helper Banner */}
      <div className="mt-12 p-6 rounded-3xl calm-surface flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#EDE9FE] text-[#2F3159] flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-[#2F3159]">Unsure about your movement mechanics?</h4>
            <p className="text-xs text-[#696C92] mt-0.5">
              Each exercise includes step-by-step postural guidelines, joint tracking landmarks, and breathing techniques.
            </p>
          </div>
        </div>

        {selectedExercise && (
          <button
            onClick={() => onSelectExercise(selectedExercise)}
            className="px-6 py-2.5 rounded-full bg-[#7F00FF] text-white font-semibold text-xs hover:bg-[#6E00DE] shadow-sm transition-all shrink-0"
          >
            Learn {selectedExercise.name} →
          </button>
        )}
      </div>

    </div>
  );
}
