package com.deutschflow.teacher.service;

import com.deutschflow.common.exception.BadRequestException;
import com.deutschflow.common.exception.ForbiddenException;
import com.deutschflow.common.exception.NotFoundException;
import com.deutschflow.teacher.dto.CreateModuleRequest;
import com.deutschflow.teacher.dto.CurriculumModuleDto;
import com.deutschflow.teacher.dto.ReorderModulesRequest;
import com.deutschflow.teacher.dto.UpdateModuleRequest;
import com.deutschflow.teacher.entity.CurriculumModule;
import com.deutschflow.teacher.repository.ClassStudentRepository;
import com.deutschflow.teacher.repository.ClassTeacherRepository;
import com.deutschflow.teacher.repository.CurriculumModuleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class CurriculumModuleService {

    private final CurriculumModuleRepository moduleRepository;
    private final ClassTeacherRepository classTeacherRepository;
    private final ClassStudentRepository classStudentRepository;

    @Transactional(readOnly = true)
    public List<CurriculumModuleDto> listForTeacher(Long teacherId, Long classId) {
        assertTeacherOwns(teacherId, classId);
        return toDtos(classId);
    }

    @Transactional(readOnly = true)
    public List<CurriculumModuleDto> listForStudent(Long studentId, Long classId) {
        assertStudentEnrolled(studentId, classId);
        return toDtos(classId);
    }

    @Transactional
    public CurriculumModuleDto create(Long teacherId, Long classId, CreateModuleRequest req) {
        assertTeacherOwns(teacherId, classId);
        if (req == null || req.title() == null || req.title().isBlank()) {
            throw new BadRequestException("Tên module không được để trống");
        }
        int nextOrder = moduleRepository.findMaxOrderIndex(classId) + 1;
        CurriculumModule module = CurriculumModule.builder()
                .classId(classId)
                .orderIndex(nextOrder)
                .title(req.title().trim())
                .build();
        return CurriculumModuleDto.from(moduleRepository.save(module));
    }

    @Transactional
    public CurriculumModuleDto update(Long teacherId, Long classId, Long moduleId, UpdateModuleRequest req) {
        assertTeacherOwns(teacherId, classId);
        CurriculumModule module = loadModuleInClass(classId, moduleId);
        if (req == null || req.title() == null || req.title().isBlank()) {
            throw new BadRequestException("Tên module không được để trống");
        }
        module.setTitle(req.title().trim());
        return CurriculumModuleDto.from(moduleRepository.save(module));
    }

    @Transactional
    public void delete(Long teacherId, Long classId, Long moduleId) {
        assertTeacherOwns(teacherId, classId);
        CurriculumModule module = loadModuleInClass(classId, moduleId);
        // FK ON DELETE SET NULL un-groups this module's lessons (does not delete them).
        moduleRepository.delete(module);
    }

    @Transactional
    public List<CurriculumModuleDto> reorder(Long teacherId, Long classId, ReorderModulesRequest req) {
        assertTeacherOwns(teacherId, classId);
        if (req == null || req.orderedModuleIds() == null || req.orderedModuleIds().isEmpty()) {
            throw new BadRequestException("Danh sách thứ tự không được trống");
        }
        List<CurriculumModule> existing = moduleRepository.findByClassIdOrderByOrderIndexAsc(classId);
        Map<Long, CurriculumModule> byId = new HashMap<>();
        existing.forEach(m -> byId.put(m.getId(), m));

        List<Long> ordered = req.orderedModuleIds();
        // Must be a true permutation: reject duplicates/omissions. A same-length list that
        // duplicates one id and omits another (e.g. [1,2,2]) would otherwise pass and corrupt
        // order_index — the duplicate is written twice (last wins) while the omitted module
        // keeps its stale index, yielding duplicate order_index values with no UNIQUE guard.
        if (ordered.size() != existing.size()
                || new HashSet<>(ordered).size() != ordered.size()
                || !byId.keySet().containsAll(ordered)) {
            throw new BadRequestException("Danh sách module IDs không khớp với lớp");
        }
        for (int i = 0; i < ordered.size(); i++) {
            CurriculumModule m = byId.get(ordered.get(i));
            if (m.getOrderIndex() != i) {
                m.setOrderIndex(i);
                moduleRepository.save(m);
            }
        }
        return toDtos(classId);
    }

    private List<CurriculumModuleDto> toDtos(Long classId) {
        return moduleRepository.findByClassIdOrderByOrderIndexAsc(classId)
                .stream().map(CurriculumModuleDto::from).toList();
    }

    private void assertTeacherOwns(Long teacherId, Long classId) {
        if (!classTeacherRepository.existsByIdClassIdAndIdTeacherId(classId, teacherId)) {
            throw new ForbiddenException("Bạn không có quyền với lớp học này");
        }
    }

    private void assertStudentEnrolled(Long studentId, Long classId) {
        if (!classStudentRepository.existsByIdClassIdAndIdStudentId(classId, studentId)) {
            throw new NotFoundException("Không tìm thấy lớp học");
        }
    }

    private CurriculumModule loadModuleInClass(Long classId, Long moduleId) {
        CurriculumModule module = moduleRepository.findById(moduleId)
                .orElseThrow(() -> new NotFoundException("Module không tồn tại"));
        if (!Objects.equals(module.getClassId(), classId)) {
            throw new BadRequestException("Module không thuộc lớp này");
        }
        return module;
    }
}
