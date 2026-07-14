package com.deutschflow.material;

import com.deutschflow.material.entity.ClassMaterial;
import com.deutschflow.material.entity.ClassMaterialId;
import com.deutschflow.material.entity.Material;
import com.deutschflow.material.entity.MaterialFolder;
import com.deutschflow.material.repository.ClassMaterialRepository;
import com.deutschflow.material.repository.MaterialFolderRepository;
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
import org.springframework.jdbc.core.JdbcTemplate;

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
    @Autowired private MaterialFolderRepository folderRepository;
    @Autowired private ClassMaterialRepository classMaterialRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private OrganizationRepository organizationRepository;
    @Autowired private TeacherClassRepository teacherClassRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

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

    // --------------------------------------------------------------- V258 Materials Library schema

    @Test
    @DisplayName("kind=LINK persists with a NULL object_key (chk_material_object_key allows it)")
    void linkMaterial_nullObjectKey_persists() {
        User teacher = newUser();
        Material link = materialRepository.saveAndFlush(Material.builder()
                .ownerScope("PERSONAL").teacherId(teacher.getId()).createdBy(teacher.getId())
                .title("allango Track").kind("LINK").externalUrl("https://allango.net/x")
                .status("ACTIVE").build());

        assertThat(link.getId()).isNotNull();
        assertThat(link.getObjectKey()).isNull();
    }

    @Test
    @DisplayName("chk_material_object_key rejects a non-LINK material with a NULL object_key")
    void fileMaterial_nullObjectKey_violatesCheck() {
        User teacher = newUser();
        Material bad = Material.builder()
                .ownerScope("PERSONAL").teacherId(teacher.getId()).createdBy(teacher.getId())
                .title("Thiếu file").kind("PDF").objectKey(null).status("ACTIVE").build();

        assertThatThrownBy(() -> materialRepository.saveAndFlush(bad))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("tags text[] round-trips and is filterable via the GIN @> containment query")
    void tags_textArray_roundtripsAndGinQueryable() {
        User teacher = newUser();
        Material m = materialRepository.saveAndFlush(Material.builder()
                .ownerScope("PERSONAL").teacherId(teacher.getId()).createdBy(teacher.getId())
                .title("Hörtext Lektion 3").kind("AUDIO").objectKey("materials/p/x.mp3").status("ACTIVE")
                .tags(new String[]{"Hören", "Netzwerk A1"}).build());

        assertThat(materialRepository.findById(m.getId()).orElseThrow().getTags())
                .containsExactly("Hören", "Netzwerk A1");
        // tag containment hit
        assertThat(materialRepository.searchPersonal(teacher.getId(), "ACTIVE", null, null, "Hören", null))
                .extracting(Material::getId).contains(m.getId());
        // tag miss
        assertThat(materialRepository.searchPersonal(teacher.getId(), "ACTIVE", null, null, "Sprechen", null))
                .isEmpty();
        // query (ILIKE) + kind together
        assertThat(materialRepository.searchPersonal(teacher.getId(), "ACTIVE", "hörtext", "AUDIO", null, null))
                .extracting(Material::getId).contains(m.getId());
    }

    @Test
    @DisplayName("searchPersonal is owner-scoped — never returns another teacher's material")
    void searchPersonal_isOwnerScoped() {
        User a = newUser();
        User b = newUser();
        Material mb = materialRepository.saveAndFlush(Material.builder()
                .ownerScope("PERSONAL").teacherId(b.getId()).createdBy(b.getId())
                .title("B's file").kind("PDF").objectKey("materials/b.pdf").status("ACTIVE")
                .tags(new String[]{"Hören"}).build());

        assertThat(materialRepository.searchPersonal(a.getId(), "ACTIVE", null, null, "Hören", null))
                .extracting(Material::getId).doesNotContain(mb.getId());
    }

    @Test
    @DisplayName("chk_folder_owner rejects an ORG folder that also carries a teacher_id")
    void folder_mixedOwner_violatesCheck() {
        User author = newUser();
        Organization org = newOrg();
        MaterialFolder bad = MaterialFolder.builder()
                .ownerScope("ORG").orgId(org.getId()).teacherId(author.getId()) // both set → violates CHECK
                .createdBy(author.getId()).name("Sai chủ").orderIndex(0).build();

        assertThatThrownBy(() -> folderRepository.saveAndFlush(bad))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("deleting a folder SET NULLs folder_id on its materials (material survives)")
    void deleteFolder_setsNullOnMaterials() {
        User teacher = newUser();
        MaterialFolder folder = folderRepository.saveAndFlush(MaterialFolder.builder()
                .ownerScope("PERSONAL").teacherId(teacher.getId()).createdBy(teacher.getId())
                .name("Lektion 3").orderIndex(0).build());
        Material m = materialRepository.saveAndFlush(Material.builder()
                .ownerScope("PERSONAL").teacherId(teacher.getId()).createdBy(teacher.getId())
                .title("Trong thư mục").kind("PDF").objectKey("materials/f.pdf").status("ACTIVE")
                .folderId(folder.getId()).build());

        folderRepository.delete(folder);
        folderRepository.flush();

        // Read via JDBC to bypass the JPA first-level cache and see the DB's SET NULL cascade.
        Long folderIdAfter = jdbcTemplate.queryForObject(
                "SELECT folder_id FROM materials WHERE id = ?", Long.class, m.getId());
        assertThat(folderIdAfter).isNull(); // FK ON DELETE SET NULL — material row itself not deleted
        assertThat(materialRepository.existsById(m.getId())).isTrue();
    }

    @Test
    @DisplayName("assignment_material FK rejects a dangling material_id/assignment_id (table + FKs exist)")
    void assignmentMaterial_fkRejectsDangling() {
        assertThatThrownBy(() -> jdbcTemplate.update(
                "INSERT INTO assignment_material (assignment_id, material_id) VALUES (?, ?)",
                999_999_999L, 999_999_999L))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("searchOrg is org-scoped — a member of one org never sees another org's materials")
    void searchOrg_isOrgScoped() {
        Organization orgA = newOrg();
        Organization orgB = newOrg();
        User author = newUser();
        Material inB = materialRepository.saveAndFlush(Material.builder()
                .ownerScope("ORG").orgId(orgB.getId()).createdBy(author.getId())
                .title("B org Hörtext").kind("AUDIO").objectKey("materials/b-org.mp3").status("ACTIVE")
                .tags(new String[]{"Hören"}).build());

        // org A's search must NOT return org B's material...
        assertThat(materialRepository.searchOrg(orgA.getId(), "ACTIVE", null, null, "Hören", null))
                .extracting(Material::getId).doesNotContain(inB.getId());
        // ...but org B's own search DOES.
        assertThat(materialRepository.searchOrg(orgB.getId(), "ACTIVE", null, null, "Hören", null))
                .extracting(Material::getId).contains(inB.getId());
    }

    @Test
    @DisplayName("the folder_id search predicate narrows results to a single folder")
    void search_folderIdFilter_narrows() {
        User teacher = newUser();
        MaterialFolder folder = folderRepository.saveAndFlush(MaterialFolder.builder()
                .ownerScope("PERSONAL").teacherId(teacher.getId()).createdBy(teacher.getId())
                .name("Lektion 5").orderIndex(0).build());
        Material inFolder = materialRepository.saveAndFlush(Material.builder()
                .ownerScope("PERSONAL").teacherId(teacher.getId()).createdBy(teacher.getId())
                .title("Trong thư mục").kind("PDF").objectKey("materials/in.pdf").status("ACTIVE")
                .folderId(folder.getId()).build());
        Material outOfFolder = materialRepository.saveAndFlush(Material.builder()
                .ownerScope("PERSONAL").teacherId(teacher.getId()).createdBy(teacher.getId())
                .title("Ngoài thư mục").kind("PDF").objectKey("materials/out.pdf").status("ACTIVE")
                .build());

        List<Material> filtered = materialRepository.searchPersonal(
                teacher.getId(), "ACTIVE", null, null, null, folder.getId());
        assertThat(filtered).extracting(Material::getId)
                .contains(inFolder.getId()).doesNotContain(outOfFolder.getId());
    }
}
