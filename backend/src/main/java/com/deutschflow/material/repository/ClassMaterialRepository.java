package com.deutschflow.material.repository;

import com.deutschflow.material.entity.ClassMaterial;
import com.deutschflow.material.entity.ClassMaterialId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ClassMaterialRepository extends JpaRepository<ClassMaterial, ClassMaterialId> {

    List<ClassMaterial> findByIdClassId(Long classId);

    boolean existsByIdClassIdAndIdMaterialId(Long classId, Long materialId);
}
