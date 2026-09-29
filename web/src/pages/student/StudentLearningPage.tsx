import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { LoadingState } from '../../components/common/LoadingState';
import { api } from '../../services/api';

export const StudentLearningPage: React.FC = () => {
  const navigate = useNavigate();
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadStudentUnits();
  }, []);

  const loadStudentUnits = async () => {
    try {
      setLoading(true);
      const data = await api.getStudentUnits();
      setUnits(data);
    } catch (err) {
      console.error('Failed to load student units', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-gradient-to-r from-[#0B1437] to-[#1A234A] text-white">
        <h1 className="text-xl font-bold">My Learning & Assessments</h1>
        <p className="text-xs text-slate-300 mt-1">
          Access published learning units, take evidence-locked practice quizzes, and master key concepts.
        </p>
      </Card>

      {loading ? (
        <LoadingState message="Loading your assigned learning units..." />
      ) : units.length === 0 ? (
        <Card className="p-10 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-800">No Published Units Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            When your teacher approves and publishes learning packs, they will appear here.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {units.map((unit) => (
            <Card key={unit.id} hoverable className="flex flex-col justify-between">
              <div className="p-5 space-y-2">
                <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  {unit.target_grade}
                </span>
                <h3 className="font-bold text-slate-900 text-sm">{unit.title}</h3>
                <p className="text-xs text-slate-500">
                  {unit.quiz_count} Formative Questions • {unit.difficulty} Level
                </p>
              </div>

              <div className="p-4 bg-[#FAFBFD] border-t border-[#F0F3F8] rounded-b-[14px]">
                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => navigate(`/student/quiz/${unit.id}`)}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Start Assessment
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
