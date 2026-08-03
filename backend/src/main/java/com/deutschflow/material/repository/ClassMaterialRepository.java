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

    /** How many classes a material is attached to — used to warn before archiving it. */
    long countByIdMaterialId(Long materialId);

    /** Detach one material from one class (mirror of the lesson/assignment detach). */
    void deleteByIdClassIdAndIdMaterialId(Long classId, Long materialId);

    /** Detach every material of a class — run while deleting the class (FK is NO ACTION). */
    void deleteByIdClassId(Long classId);
}
