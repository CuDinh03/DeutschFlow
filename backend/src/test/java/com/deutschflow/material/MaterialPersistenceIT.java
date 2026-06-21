package com.deutschflow.material;

import com.deutschflow.material.entity.ClassMaterial;
import com.deutschflow.material.entity.ClassMaterialId;
import com.deutschflow.material.entity.Material;
import com.deutschflow.material.repository.ClassMaterialRepository;
import com.deutschflow.material.repository.MaterialRepository;
import com.deutschflow.organization.entity.Organization;
import com.deutschflow.organization.repository.OrganizationRepository;
import com.deutschflow.teacher.entity.TeacherClass;
import com.deutschflow.teacher.repository.TeacherClassRepository;
import com.deutschflow.testsupport.AbstractPostgresIntegrationTest;
import com.deutschflow.user.entity.User;
import com.deutschflow.user.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Integration coverage for the V227 materials schema against a real PostgreSQL (Testcontainers):
 * proves the migration applies, the {@code chk_material_owner} CHECK enforces the ownership
 * invariant, the partial-index queries work, and {@code class_materials} FKs {@code teacher_classes}.
 * These are exactly the guarantees unit tests with mocked repositories cannot give.
 */
@SpringBootTest
@DisplayName("Material persistence Integration Tests (V227 schema)")
class MaterialPersistenceIT extends AbstractPostgresIntegrationTest {

    @Autowired private MaterialRepository materialRepository;
    @Autowired private ClassMaterialRepository classMaterialRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private TeacherClassRepository teacherClassRepository;

    private User newUser() {
        return userRepository.save(User.builder()
                .email("mat-" + UUID.randomUUID() + "@test.local")
                .passwordHash("x")
                .displayName("Mat Tester")
                .role(User.Role.TEACHER)
                .build());
    }

    private Organization newOrg() {
        return organizationRepository.save(Organization.builder()
                .name("Org " + UUID.randomUUID())
                .slug("org-" + UUID.randomUUID())
                .build());
    }

    @Test
    @DisplayName("persists a PERSONAL material and finds it via the partial-index query")
    void personalMaterial_persistsAndQueries() {
        User teacher = newUser();
        Material m = materialRepository.save(Material.builder()
                .ownerScope("PERSONAL").teacherId(teacher.getId()).createdBy(teacher.getId())
                .title("Slide cá nhân").kind("PDF").objectKey("materials/p.pdf").status("ACTIVE")
                .build());

        assertThat(m.getId()).isNotNull();
        List<Material> found = materialRepository
                .findByOwnerScopeAndTeacherIdAndStatusOrderByCreatedAtDesc("PERSONAL", teacher.getId(), "ACTIVE");
        assertThat(found).extracting(Material::getId).contains(m.getId());
    }

    @Test
    @DisplayName("persists an ORG material and finds it via the org partial-index query")
    void orgMaterial_persistsAndQueries() {
        User author = newUser();
        Organization org = newOrg();
        Material m = materialRepository.save(Material.builder()
                .ownerScope("ORG").orgId(org.getId()).createdBy(author.getId())
                .title("Slide tổ chức").kind("PPTX").objectKey("materials/o.pptx").status("ACTIVE")
                .build());

        List<Material> found = materialRepository
                .findByOwnerScopeAndOrgIdAndStatusOrderByCreatedAtDesc("ORG", org.getId(), "ACTIVE");
        assertThat(found).extracting(Material::getId).contains(m.getId());
    }

    @Test
    @DisplayName("chk_material_owner rejects an ORG material that also carries a teacher_id")
    void checkConstraint_rejectsMixedOwner() {
        User author = newUser();
        Organization org = newOrg();
        Material bad = Material.builder()
                .ownerScope("ORG").orgId(org.getId()).teacherId(author.getId()) // both set → violates CHECK
                .createdBy(author.getId())
                .title("Sai chủ").kind("PDF").objectKey("materials/bad.pdf").status("ACTIVE")
                .build();

        assertThatThrownBy(() -> materialRepository.saveAndFlush(bad))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("chk_material_owner rejects a PERSONAL material with no owner")
    void checkConstraint_rejectsOwnerless() {
        User author = newUser();
        Material bad = Material.builder()
                .ownerScope("PERSONAL").createdBy(author.getId()) // teacher_id null → violates CHECK
                .title("Vô chủ").kind("PDF").objectKey("materials/none.pdf").status("ACTIVE")
                .build();

        assertThatThrownBy(() -> materialRepository.saveAndFlush(bad))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("class_materials attaches a material to a teacher_classes row (FK resolves)")
    void classMaterial_attachesToTeacherClass() {
        User teacher = newUser();
        Material m = materialRepository.save(Material.builder()
                .ownerScope("PERSONAL").teacherId(teacher.getId()).createdBy(teacher.getId())
                .title("Đính kèm").kind("PDF").objectKey("materials/a.pdf").status("ACTIVE")
                .build());
        TeacherClass tc = teacherClassRepository.save(TeacherClass.builder()
                .teacherId(teacher.getId()).name("A1.1").inviteCode("INV-" + UUID.randomUUID())
                .createdAt(LocalDateTime.now()).build());

        classMaterialRepository.save(ClassMaterial.builder()
                .id(new ClassMaterialId(tc.getId(), m.getId()))
                .attachedBy(teacher.getId())
                .build());

        assertThat(classMaterialRepository.existsByIdClassIdAndIdMaterialId(tc.getId(), m.getId())).isTrue();
        assertThat(classMaterialRepository.findByIdClassId(tc.getId()))
                .extracting(cm -> cm.getId().getMaterialId()).contains(m.getId());
    }
}
